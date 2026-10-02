'use client'

import { useEffect, useRef, useState } from 'react'
import { LuImageUp, LuTrash2 } from 'react-icons/lu'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { BRAND_SLOT_LABELS, MEDIA_LIMITS, type BrandSlot } from '@/domain/media'
import { formatFileSize } from '@/lib/format'
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

// Logo e capa em rascunho, como o resto da Identidade: escolher um arquivo
// só o prepara (comprime e confere o peso) e mostra na prévia; o envio e a
// gravação acontecem no "Salvar identidade".
export type BrandDraft =
  | { kind: 'saved'; path: string | null }
  | { kind: 'new'; blob: Blob; mimeType: string; previewUrl: string }
  | { kind: 'removed' }

/** O que a prévia desenha: o caminho gravado ou a imagem local. */
export function brandPreviewPath(draft: BrandDraft): string | null {
  if (draft.kind === 'saved') return draft.path
  if (draft.kind === 'new') return draft.previewUrl
  return null
}

export function brandChanged(draft: BrandDraft, original: string | null): boolean {
  if (draft.kind === 'saved') return false
  if (draft.kind === 'removed') return original !== null
  return true
}

export function revokeBrandPreview(draft: BrandDraft) {
  if (draft.kind === 'new') URL.revokeObjectURL(draft.previewUrl)
}

// Grava uma troca de logo ou capa: sobe o arquivo e aponta o restaurante
// para ele, ou remove. Devolve o caminho gravado, ou a causa exata da falha.
export async function commitBrandImage(
  restaurantId: string,
  slot: BrandSlot,
  draft: BrandDraft,
  original: string | null,
): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  const label = BRAND_SLOT_LABELS[slot]
  if (draft.kind === 'saved') return { ok: true, path: original }
  if (draft.kind === 'removed') {
    if (original === null) return { ok: true, path: null }
    const removed = await setBrandImageAction({ restaurantId, slot, storagePath: null })
    return removed.ok ? { ok: true, path: null } : { ok: false, error: `${label}: ${removed.error}` }
  }

  const ticket = await createBrandUploadTicketAction({ restaurantId, slot, mimeType: draft.mimeType })
  if (!ticket.ok) return { ok: false, error: `${label}: ${ticket.error}` }
  try {
    await uploadToSignedUrl(ticket.data.signedUrl, draft.blob, draft.mimeType)
  } catch {
    return { ok: false, error: `Não foi possível enviar a ${label.toLowerCase()}. Confira a conexão e tente de novo.` }
  }
  const saved = await setBrandImageAction({ restaurantId, slot, storagePath: ticket.data.path })
  return saved.ok ? { ok: true, path: ticket.data.path } : { ok: false, error: `${label}: ${saved.error}` }
}

function imageSrc(path: string) {
  // A imagem local (blob:) é desenhada como está; a gravada vem do storage.
  return path.startsWith('blob:') ? path : publicMediaUrl('image', path)
}

// O bloco inteiro é a área de escolha: clicar, arrastar ou colar.
function BrandTile({
  slot,
  draft,
  disabled,
  onChange,
}: {
  slot: BrandSlot
  draft: BrandDraft
  disabled: boolean
  onChange: (draft: BrandDraft) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tileRef = useRef<HTMLDivElement>(null)
  // Contador, e não booleano: `dragleave` dispara ao passar por cima de um
  // FILHO, e com booleano o estado pisca a cada movimento do mouse.
  const dragDepth = useRef(0)
  const [draggingOver, setDraggingOver] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const label = BRAND_SLOT_LABELS[slot]
  const copy = SLOT_COPY[slot]
  const blocked = preparing || disabled
  const path = brandPreviewPath(draft)

  async function chooseFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.add({ title: 'Envie uma imagem JPG, PNG, WebP ou AVIF.', type: 'error' })
      return
    }
    setPreparing(true)
    try {
      // Comprime ANTES de conferir o teto. A capa é a imagem mais pesada do
      // sistema, e recusar o original de uma foto que comprimiria bem abaixo
      // do limite desperdiçaria justamente a compressão.
      const compression = await compressImage(file)
      const blob = compression.blob
      if (blob.size > MEDIA_LIMITS.image.maxBytes) {
        toast.add({
          title: 'Arquivo grande demais',
          description: `Mesmo comprimido ficou com ${formatFileSize(blob.size)}, e o limite é ${formatFileSize(MEDIA_LIMITS.image.maxBytes)}.`,
          type: 'error',
        })
        return
      }
      revokeBrandPreview(draft)
      // O tipo do BLOB, e não o do arquivo: depois da compressão eles
      // divergem, e mandar o antigo gravaria um content-type errado.
      onChange({ kind: 'new', blob, mimeType: blob.type || file.type, previewUrl: URL.createObjectURL(blob) })
    } catch {
      toast.add({ title: `Não foi possível ler a imagem “${file.name}”.`, type: 'error' })
    } finally {
      setPreparing(false)
    }
  }

  function removeImage() {
    revokeBrandPreview(draft)
    onChange({ kind: 'removed' })
  }

  // Colar vai para o bloco em que a pessoa está — com foco ou sob o
  // ponteiro. Ouvir a janela nos dois blocos mandaria a mesma imagem para o
  // logo E para a capa.
  useEffect(() => {
    if (blocked) return

    function handlePaste(event: ClipboardEvent) {
      const tile = tileRef.current
      if (!tile || !(tile.matches(':hover') || tile.contains(document.activeElement))) return
      const file = event.clipboardData?.files[0]
      if (!file) return
      event.preventDefault()
      void chooseFile(file)
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
      aria-busy={preparing || undefined}
      onDragEnter={(event) => {
        event.preventDefault()
        if (blocked) return
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
        if (!blocked && file) void chooseFile(file)
      }}
    >
      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc(path)} alt="" />
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
        aria-label={`Escolher ${label.toLowerCase()}`}
        aria-hidden={path ? true : undefined}
        tabIndex={path ? -1 : undefined}
        title={copy.help}
        disabled={blocked}
        onClick={() => inputRef.current?.click()}
      />

      {path ? (
        <div className="tv-brand-tile-actions">
          {/* No quadrado de 120 px do logo só cabem os ícones; o nome
              acessível leva o texto nos dois blocos. */}
          <button type="button" aria-label={`Trocar ${label.toLowerCase()}`} title="Trocar" disabled={blocked} onClick={() => inputRef.current?.click()}>
            <LuImageUp aria-hidden="true" />
            <span>Trocar</span>
          </button>
          <button type="button" aria-label={`Remover ${label.toLowerCase()}`} title="Remover" disabled={blocked} onClick={removeImage}>
            <LuTrash2 aria-hidden="true" />
            <span>Remover</span>
          </button>
        </div>
      ) : null}

      {preparing ? (
        <span className="tv-brand-tile-busy">
          <Spinner className="size-[18px]" aria-label={`Preparando ${label.toLowerCase()}`} />
        </span>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        disabled={blocked}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void chooseFile(file)
          // Zerar permite escolher o MESMO arquivo de novo depois de removê-lo.
          event.target.value = ''
        }}
      />
    </div>
  )
}

export function BrandImages({
  drafts,
  disabled = false,
  onChange,
}: {
  drafts: Record<BrandSlot, BrandDraft>
  disabled?: boolean
  onChange: (slot: BrandSlot, draft: BrandDraft) => void
}) {
  return (
    <section className="tv-identity-card" aria-labelledby="identity-brand-title">
      <div className="tv-identity-card-head">
        <h2 id="identity-brand-title">Logo e capa</h2>
        <p>Valem quando você salvar a identidade.</p>
      </div>
      <div className="tv-brand-tiles">
        <BrandTile slot="logo" draft={drafts.logo} disabled={disabled} onChange={(draft) => onChange('logo', draft)} />
        <BrandTile slot="cover" draft={drafts.cover} disabled={disabled} onChange={(draft) => onChange('cover', draft)} />
      </div>
    </section>
  )
}
