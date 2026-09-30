'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { LuImageUp, LuTrash2 } from 'react-icons/lu'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { BRAND_SLOT_LABELS, MEDIA_LIMITS, type BrandSlot } from '@/domain/media'
import { compressImage } from '@/lib/media/compress-image'
import { publicMediaUrl } from '@/lib/media-url'
import { uploadToSignedUrl } from '@/lib/upload'
import {
  createBrandUploadTicketAction,
  setBrandImageAction,
} from '@/server/actions/media'

const SLOT_COPY: Record<BrandSlot, { empty: string; help: string }> = {
  logo: {
    empty: 'Logo',
    help: 'Quadrada funciona melhor. Aparece sobre a capa, no topo do cardápio.',
  },
  cover: {
    empty: 'Capa · 1600 × 900',
    help: 'Deitada, bem larga. É a primeira coisa que o cliente vê.',
  },
}

const ACCEPTED_TYPES: readonly string[] = MEDIA_LIMITS.image.mimes

// O bloco inteiro é a área de envio: clicar, arrastar ou colar. Logo e capa
// gravam SOZINHAS, na hora — envio de arquivo já é uma confirmação por si, e
// amarrá-lo ao "Salvar identidade" criaria um estado em que o arquivo está no
// storage e o banco ainda não sabe dele.
function BrandTile({
  restaurantId,
  slot,
  path,
  onChange,
}: {
  restaurantId: string
  slot: BrandSlot
  path: string | null
  onChange: (path: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tileRef = useRef<HTMLDivElement>(null)
  // Contador, e não booleano: `dragleave` dispara ao passar por cima de um
  // FILHO, e com booleano o estado pisca a cada movimento do mouse.
  const dragDepth = useRef(0)
  const [draggingOver, setDraggingOver] = useState(false)
  const [pending, startTransition] = useTransition()
  const label = BRAND_SLOT_LABELS[slot]
  const copy = SLOT_COPY[slot]

  function uploadFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.add({ title: 'Envie uma imagem JPG, PNG, WebP ou AVIF.', type: 'error' })
      return
    }

    // As actions vão DENTRO de startTransition por virem de manipulador de
    // evento — contrato documentado do Next 16.3.5. Fora dela, a revalidação
    // pode não voltar aplicada e a tela fica velha depois de um envio que
    // deu certo.
    startTransition(async () => {
      // Comprime ANTES de conferir o teto. A capa é a imagem mais pesada do
      // sistema, e recusar o original de uma foto que comprimiria bem abaixo
      // do limite desperdiçaria justamente a compressão.
      const compression = await compressImage(file)
      const blob = compression.blob

      if (blob.size > MEDIA_LIMITS.image.maxBytes) {
        toast.add({
          title: 'Arquivo grande demais',
          description: `Mesmo comprimido ficou em ${(blob.size / 1_048_576).toFixed(1)} MB, e o limite é ${Math.round(MEDIA_LIMITS.image.maxBytes / 1_048_576)} MB.`,
          type: 'error',
        })
        return
      }

      // O tipo do BLOB, e não o do arquivo: depois da compressão eles
      // divergem, e mandar o antigo grava no storage um arquivo com
      // content-type errado — que o navegador depois não desenha.
      const mimeType = blob.type || file.type

      const ticket = await createBrandUploadTicketAction({
        restaurantId,
        slot,
        mimeType,
      })
      if (!ticket.ok) {
        toast.add({ title: ticket.error, type: 'error' })
        return
      }

      try {
        await uploadToSignedUrl(ticket.data.signedUrl, blob, mimeType)
      } catch {
        toast.add({ title: 'Não foi possível enviar o arquivo.', type: 'error' })
        return
      }

      const savedResult = await setBrandImageAction({
        restaurantId,
        slot,
        storagePath: ticket.data.path,
      })
      if (savedResult.ok) {
        onChange(ticket.data.path)
        toast.add({ title: `${label} atualizada`, type: 'success' })
      } else {
        toast.add({ title: savedResult.error, type: 'error' })
      }
    })
  }

  function removeImage() {
    startTransition(async () => {
      const result = await setBrandImageAction({
        restaurantId,
        slot,
        storagePath: null,
      })
      if (result.ok) {
        onChange(null)
        toast.add({ title: `${label} removida`, type: 'success' })
      } else {
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  // Colar vai para o bloco em que a pessoa está — com foco ou sob o
  // ponteiro. Ouvir a janela nos dois blocos mandaria a mesma imagem para o
  // logo E para a capa.
  useEffect(() => {
    if (pending) return

    function handlePaste(event: ClipboardEvent) {
      const tile = tileRef.current
      if (!tile || !(tile.matches(':hover') || tile.contains(document.activeElement))) return
      const file = event.clipboardData?.files[0]
      if (!file) return
      event.preventDefault()
      uploadFile(file)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  })

  return (
    <div
      ref={tileRef}
      className={`tv-brand-tile is-${slot}`}
      data-filled={path ? '' : undefined}
      data-dragging={draggingOver ? '' : undefined}
      aria-busy={pending || undefined}
      onDragEnter={(event) => {
        event.preventDefault()
        if (pending) return
        dragDepth.current += 1
        setDraggingOver(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDraggingOver(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        setDraggingOver(false)
        const file = event.dataTransfer.files[0]
        if (!pending && file) uploadFile(file)
      }}
    >
      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicMediaUrl('image', path)} alt="" />
      ) : (
        <span className="tv-brand-tile-empty" aria-hidden="true">
          <LuImageUp />
          {copy.empty}
        </span>
      )}

      {/* Com imagem, o teclado usa "Trocar" e "Remover"; o bloco continua
          clicável para o mouse, sem repetir o mesmo botão no Tab. */}
      <button
        type="button"
        className="tv-brand-tile-hit"
        aria-label={`Enviar ${label.toLowerCase()}`}
        aria-hidden={path ? true : undefined}
        tabIndex={path ? -1 : undefined}
        title={copy.help}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      />

      {path ? (
        <div className="tv-brand-tile-actions">
          {/* No quadrado de 120 px do logo só cabem os ícones; o nome
              acessível leva o texto nos dois blocos. */}
          <button type="button" aria-label={`Trocar ${label.toLowerCase()}`} title="Trocar" disabled={pending} onClick={() => inputRef.current?.click()}>
            <LuImageUp aria-hidden="true" />
            <span>Trocar</span>
          </button>
          <button type="button" aria-label={`Remover ${label.toLowerCase()}`} title="Remover" disabled={pending} onClick={removeImage}>
            <LuTrash2 aria-hidden="true" />
            <span>Remover</span>
          </button>
        </div>
      ) : null}

      {pending ? (
        <span className="tv-brand-tile-busy">
          <Spinner className="size-[18px]" aria-label={`Enviando ${label.toLowerCase()}`} />
        </span>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) uploadFile(file)
          // Zerar permite escolher o MESMO arquivo de novo depois de removê-lo.
          event.target.value = ''
        }}
      />
    </div>
  )
}

export function BrandImages({
  restaurantId,
  logoPath,
  coverPath,
  onChange,
}: {
  restaurantId: string
  logoPath: string | null
  coverPath: string | null
  onChange: (slot: BrandSlot, path: string | null) => void
}) {
  return (
    <section className="tv-identity-card" aria-labelledby="identity-brand-title">
      <div className="tv-identity-card-head">
        <h2 id="identity-brand-title">Logo e capa</h2>
        <p>Gravam sozinhas, na hora do envio.</p>
      </div>
      <div className="tv-brand-tiles">
        <BrandTile restaurantId={restaurantId} slot="logo" path={logoPath} onChange={(path) => onChange('logo', path)} />
        <BrandTile restaurantId={restaurantId} slot="cover" path={coverPath} onChange={(path) => onChange('cover', path)} />
      </div>
    </section>
  )
}
