'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { LuCamera, LuCircleCheck, LuImagePlus, LuSend, LuX } from 'react-icons/lu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MAX_PHOTOS, FEEDBACK_MIN_LENGTH } from '@/domain/feedback'
import { MEDIA_LIMITS } from '@/domain/media'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { compressImage } from '@/lib/media/compress-image'
import { uploadToSignedUrl } from '@/lib/upload'
import { publishFeedbackAction, startFeedbackAction } from '@/server/actions/feedback'

type Photo = { key: number; blob: Blob; width: number; height: number; preview: string }
type Phase = 'editing' | 'sending' | 'sent'

const ACCEPTED = MEDIA_LIMITS.image.mimes as readonly string[]
// A lista explícita faz o iOS converter HEIC em JPEG na hora de escolher.
const GALLERY_ACCEPT = ACCEPTED.join(',')

const subscribeNoop = () => () => {}
// "Tirar foto" só faz sentido em tela de toque; no computador o `capture`
// é ignorado e o botão viraria um segundo "Escolher fotos".
function useCoarsePointer() {
  return useSyncExternalStore(subscribeNoop, () => window.matchMedia('(pointer: coarse)').matches, () => false)
}

function rejectReason(file: File): string | null {
  const name = file.name.toLowerCase()
  if (file.type === 'image/heic' || file.type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
    return 'Fotos HEIC não são aceitas. Tire a foto pelo botão Tirar foto ou escolha uma em JPG.'
  }
  if (!ACCEPTED.includes(file.type)) return 'Esse arquivo não é uma foto em JPG, PNG, WebP ou AVIF.'
  return null
}

// Feedback anônimo: texto e até 3 fotos. Nada vai ao servidor antes de
// "Enviar"; as fotos ficam só na memória desta folha até lá.
export function FeedbackSheet({
  open,
  onOpenChange,
  slug,
  restaurantName,
  presetId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  restaurantName: string
  /** O mesmo `data-menu` da rota: o portal sai do `.menu` e precisa do tema. */
  presetId: string
}) {
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [phase, setPhase] = useState<Phase>('editing')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const trapRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<Photo[]>([])
  const nextKey = useRef(0)
  const coarse = useCoarsePointer()
  const sending = phase === 'sending'
  const busy = sending || processing
  const full = photos.length >= FEEDBACK_MAX_PHOTOS

  useEffect(() => {
    photosRef.current = photos
  })
  // As miniaturas são object URLs: soltas ao desmontar, para não segurar
  // os blobs na memória do celular.
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), [])

  function reset() {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
    photosRef.current = []
    setPhotos([])
    setBody('')
    setPhase('editing')
    setError(null)
    setPhotoNotice(null)
    setConfirmDiscard(false)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  // Esc, toque fora e o X passam por aqui: durante o envio nada fecha, e
  // com algo escrito pergunta antes de descartar.
  function requestOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true)
      return
    }
    if (busy) return
    if (phase === 'editing' && (body.trim() || photos.length > 0)) {
      setConfirmDiscard(true)
      return
    }
    close()
  }

  async function addFiles(input: HTMLInputElement) {
    const files = Array.from(input.files ?? [])
    // Limpar o campo deixa escolher o mesmo arquivo de novo depois de remover.
    input.value = ''
    if (!files.length) return
    const room = Math.max(0, FEEDBACK_MAX_PHOTOS - photosRef.current.length)
    const notices: string[] = []
    if (files.length > room) notices.push('Cabem 3 fotos por feedback. Ficaram as primeiras.')

    setProcessing(true)
    setPhotoNotice(null)
    const added: Photo[] = []
    for (const file of files.slice(0, room)) {
      const reason = rejectReason(file)
      if (reason) {
        notices.push(reason)
        continue
      }
      try {
        const result = await compressImage(file, { alwaysReencode: true })
        if (result.blob.size > MEDIA_LIMITS.image.maxBytes) {
          notices.push('Essa foto passa de 5 MB mesmo comprimida. Escolha outra.')
          continue
        }
        nextKey.current += 1
        added.push({
          key: nextKey.current,
          blob: result.blob,
          width: result.width,
          height: result.height,
          preview: URL.createObjectURL(result.blob),
        })
      } catch {
        notices.push('Não conseguimos abrir essa foto. Tente outra.')
      }
    }
    setPhotos((current) => [...current, ...added].slice(0, FEEDBACK_MAX_PHOTOS))
    setProcessing(false)
    setPhotoNotice(notices.length ? [...new Set(notices)].join(' ') : null)
  }

  function removePhoto(key: number) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key)
      if (target) URL.revokeObjectURL(target.preview)
      return current.filter((photo) => photo.key !== key)
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || phase !== 'editing') return
    const text = body.trim()
    if (text.length < FEEDBACK_MIN_LENGTH) {
      setError('Escreva pelo menos 3 caracteres.')
      return
    }
    if (text.length > FEEDBACK_MAX_LENGTH) {
      setError('O texto passa de 1000 caracteres.')
      return
    }
    const website = trapRef.current?.value || undefined
    const current = photosRef.current
    setError(null)
    setPhase('sending')

    try {
      const started = await startFeedbackAction({
        slug,
        body: text,
        photos: current.map((photo) => ({ mime: photo.blob.type, width: photo.width, height: photo.height })),
        website,
      })
      if (!started.ok) {
        setError(started.error)
        setPhase('editing')
        return
      }
      for (const upload of started.data.uploads) {
        const photo = current[upload.position]
        if (!photo) continue
        try {
          await uploadToSignedUrl(upload.signedUrl, photo.blob, photo.blob.type)
        } catch {
          setError(`A foto ${upload.position + 1} não foi enviada. Verifique a conexão e toque em Enviar de novo.`)
          setPhase('editing')
          return
        }
      }
      const published = await publishFeedbackAction({ feedbackId: started.data.feedbackId, website })
      if (!published.ok) {
        setError(published.error)
        setPhase('editing')
        return
      }
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
      photosRef.current = []
      setPhotos([])
      setBody('')
      setPhase('sent')
    } catch (failure) {
      // A ação não respondeu (rede caiu): texto e fotos continuam na folha.
      console.error('[feedback] envio', failure)
      setError('Sem conexão com o servidor. Verifique a internet e toque em Enviar de novo.')
      setPhase('editing')
    }
  }

  return (
    <Sheet open={open} onOpenChange={requestOpenChange} disablePointerDismissal={busy}>
      <SheetContent
        side="bottom"
        data-menu={presetId}
        showCloseButton={!busy}
        aria-busy={sending || undefined}
        // Mesmos motivos de menu-details.tsx: as cores e as fontes do tema
        // precisam vir explícitas, porque o portal sai da árvore do `.menu`.
        className={`menu menu-sheet menu-feedback-sheet min-h-0 overflow-hidden ${ALL_THEME_FONT_VARIABLES}`}
        style={{ background: 'var(--m-base)', color: 'var(--m-ink)' }}
      >
        {phase === 'sent' ? (
          <div className="menu-feedback-done menu-feedback-scroll" role="status">
            <LuCircleCheck aria-hidden="true" className="menu-feedback-done-icon" />
            <SheetTitle className="menu-display text-[1.375rem] font-semibold" style={{ color: 'var(--m-ink)' }}>
              Obrigado!
            </SheetTitle>
            <SheetDescription style={{ color: 'var(--m-muted)' }}>
              Seu feedback foi enviado para {restaurantName}.
            </SheetDescription>
            <button type="button" className="menu-block menu-feedback-primary" onClick={close}>
              Voltar ao cardápio
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="menu-feedback">
            <div className="menu-feedback-scroll">
              <SheetHeader className="p-0">
                <SheetTitle className="menu-display text-[1.25rem] font-semibold" style={{ color: 'var(--m-ink)' }}>
                  Deixe seu feedback
                </SheetTitle>
                <SheetDescription style={{ color: 'var(--m-muted)' }}>
                  Anônimo: o restaurante não vê quem você é.
                </SheetDescription>
              </SheetHeader>

              <fieldset disabled={sending} className="menu-feedback-fields">
                <label htmlFor="feedback-body" className="sr-only">Seu feedback</label>
                {/* Sem foco automático: no celular ele abriria o teclado
                    antes de a pessoa decidir escrever. */}
                <textarea
                  id="feedback-body"
                  className="menu-block menu-feedback-text"
                  rows={5}
                  maxLength={FEEDBACK_MAX_LENGTH}
                  placeholder="Conte o que achou…"
                  value={body}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="feedback-count"
                  onChange={(event) => {
                    setBody(event.target.value)
                    setError(null)
                  }}
                />
                <span id="feedback-count" className="menu-feedback-count">
                  {body.length} / {FEEDBACK_MAX_LENGTH}
                </span>

                <span className="menu-feedback-label">Fotos (opcional, até 3)</span>
                <div className="menu-feedback-buttons">
                  {coarse ? (
                    <button
                      type="button"
                      className="menu-block menu-feedback-pick"
                      disabled={busy || full}
                      onClick={() => cameraRef.current?.click()}
                    >
                      <LuCamera aria-hidden="true" />
                      Tirar foto
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="menu-block menu-feedback-pick"
                    disabled={busy || full}
                    onClick={() => galleryRef.current?.click()}
                  >
                    <LuImagePlus aria-hidden="true" />
                    {coarse ? 'Galeria' : 'Escolher fotos'}
                  </button>
                </div>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => void addFiles(event.currentTarget)}
                />
                <input
                  ref={galleryRef}
                  type="file"
                  accept={GALLERY_ACCEPT}
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => void addFiles(event.currentTarget)}
                />

                {processing ? (
                  <p className="menu-feedback-note" role="status">
                    <Spinner className="size-3.5" aria-hidden="true" />
                    Preparando a foto…
                  </p>
                ) : null}
                {photoNotice ? <p className="menu-feedback-note is-error" role="alert">{photoNotice}</p> : null}

                {photos.length > 0 ? (
                  <ul className="menu-feedback-thumbs">
                    {photos.map((photo, index) => (
                      <li key={photo.key} className="menu-feedback-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.preview} alt={`Foto ${index + 1}`} />
                        <button
                          type="button"
                          aria-label={`Remover foto ${index + 1}`}
                          disabled={busy}
                          onClick={() => removePhoto(photo.key)}
                        >
                          <LuX aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <input
                  ref={trapRef}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="menu-feedback-trap"
                  defaultValue=""
                />
              </fieldset>
            </div>

            <div className="menu-feedback-actions">
              {error ? <p className="menu-feedback-note is-error" role="alert">{error}</p> : null}
              {confirmDiscard ? (
                <div className="menu-block menu-feedback-confirm" role="alertdialog" aria-label="Descartar o feedback?">
                  <p>Descartar o feedback?</p>
                  <div>
                    <button type="button" onClick={() => setConfirmDiscard(false)}>Continuar escrevendo</button>
                    <button type="button" className="is-danger" onClick={close}>Descartar</button>
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  className="menu-block menu-feedback-primary"
                  disabled={busy}
                  aria-busy={sending || undefined}
                >
                  {sending ? <Spinner className="size-4" aria-hidden="true" /> : null}
                  {!sending ? <LuSend aria-hidden="true" className="size-4" /> : null}
                  {sending ? 'Enviando…' : 'Enviar feedback'}
                </button>
              )}
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
