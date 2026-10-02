import { MAX_VIDEO_DURATION_MS, MEDIA_LIMITS } from '@/domain/media'
import { formatFileSize } from '@/lib/format'
import { compressImage } from '@/lib/media/compress-image'
import { compressVideo } from '@/lib/media/compress-video'
import { captureVideoPoster, readVideoDurationMs, uploadToSignedUrl } from '@/lib/upload'
import { createItemUploadTicketAction } from '@/server/actions/media'
import type { UploadedMedia } from './item-draft'

export const ACCEPTED_MEDIA_TYPES = [
  ...MEDIA_LIMITS.image.mimes,
  ...MEDIA_LIMITS.video.mimes,
] as readonly string[]

export type SelectedFile = {
  file: File
  kind: 'image' | 'video'
  /** `null` quando o navegador não leu; a preparação tenta pelo contêiner. */
  durationMs: number | null
  posterBlob: Blob | null
}

type Prepared = { blob: Blob; width?: number; height?: number; durationMs: number | null }

function seconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`
}

// Conferido no instante da escolha: tipo e duração. Um vídeo de 22 s nem
// entra na lista — antes ele entrava, o item era criado e o vídeo caía
// depois, sem o dono perceber.
export async function inspectFile(
  file: File,
): Promise<{ ok: true; value: SelectedFile } | { ok: false; error: string }> {
  if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
    return { ok: false, error: `“${file.name}” não é uma foto nem um vídeo aceito.` }
  }
  if (file.type.startsWith('image/')) {
    return { ok: true, value: { file, kind: 'image', durationMs: null, posterBlob: null } }
  }
  const [durationMs, posterBlob] = await Promise.all([readVideoDurationMs(file), captureVideoPoster(file)])
  if (durationMs !== null && durationMs > MAX_VIDEO_DURATION_MS) {
    return { ok: false, error: `“${file.name}” tem ${seconds(durationMs)}; o limite é 15 s.` }
  }
  return { ok: true, value: { file, kind: 'video', durationMs, posterBlob } }
}

// Alguns navegadores não leem a duração de certos MP4 pelo <video>; o
// contêiner ainda diz. Entra por import dinâmico, como a compressão.
async function readContainerDurationMs(file: File): Promise<number | null> {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny')
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
    const total = await input.computeDuration()
    return Number.isFinite(total) && total > 0 ? Math.round(total * 1000) : null
  } catch {
    return null
  }
}

// Comprime e confere o peso FINAL. Lança com a causa exata; quem chama
// mostra a mensagem na miniatura e bloqueia o salvar.
export async function prepareMedia(
  selected: SelectedFile,
  onProgress: (percentage: number) => void,
): Promise<Prepared> {
  const { file, kind } = selected
  let blob: Blob = file
  let width: number | undefined
  let height: number | undefined
  let durationMs = selected.durationMs

  if (kind === 'image') {
    try {
      const result = await compressImage(file)
      blob = result.blob
      width = result.width
      height = result.height
    } catch {
      throw new Error(`Não foi possível ler a imagem “${file.name}”.`)
    }
  } else {
    if (durationMs === null) durationMs = await readContainerDurationMs(file)
    if (durationMs === null) {
      throw new Error(`Não foi possível ler a duração de “${file.name}”. Envie um MP4 ou WebM de até 15 s.`)
    }
    if (durationMs > MAX_VIDEO_DURATION_MS) {
      throw new Error(`“${file.name}” tem ${seconds(durationMs)}; o limite é 15 s.`)
    }
    const result = await compressVideo(file, onProgress)
    if (result) {
      blob = result.blob
      width = result.width
      height = result.height
    }
  }

  const maxBytes = MEDIA_LIMITS[kind].maxBytes
  if (blob.size > maxBytes) {
    throw new Error(
      `“${file.name}” ficou com ${formatFileSize(blob.size)} depois de comprimido; o limite é ${formatFileSize(maxBytes)}.`,
    )
  }
  onProgress(100)
  return { blob, width, height, durationMs }
}

// Sobe um arquivo já preparado (e a capa, se for vídeo). Não registra nada
// no banco: quem registra é o `saveItemAction`, tudo de uma vez.
export async function uploadPreparedMedia({
  restaurantId,
  itemId,
  selected,
  prepared,
}: {
  restaurantId: string
  itemId: string | null
  selected: SelectedFile
  prepared: Prepared
}): Promise<{ itemId: string; media: UploadedMedia; files: { kind: 'image' | 'video'; path: string }[] }> {
  const mimeType = prepared.blob.type || selected.file.type
  const ticket = await createItemUploadTicketAction({ restaurantId, itemId, kind: selected.kind, mimeType })
  if (!ticket.ok) throw new Error(ticket.error)

  try {
    await uploadToSignedUrl(ticket.data.signedUrl, prepared.blob, mimeType)
  } catch {
    throw new Error(`Não foi possível enviar “${selected.file.name}”. Confira a conexão e tente de novo.`)
  }
  const files: { kind: 'image' | 'video'; path: string }[] = [{ kind: selected.kind, path: ticket.data.path }]

  // Falhar a capa não impede o vídeo (decisão C5): sem capa, o feed usa o
  // primeiro quadro do próprio vídeo.
  let posterPath: string | undefined
  const poster = selected.kind === 'video' ? selected.posterBlob : null
  if (poster && (MEDIA_LIMITS.image.mimes as readonly string[]).includes(poster.type)) {
    const posterTicket = await createItemUploadTicketAction({
      restaurantId,
      itemId: ticket.data.itemId,
      kind: 'image',
      mimeType: poster.type,
    })
    if (posterTicket.ok) {
      try {
        await uploadToSignedUrl(posterTicket.data.signedUrl, poster, poster.type)
        posterPath = posterTicket.data.path
        files.push({ kind: 'image', path: posterTicket.data.path })
      } catch {
        posterPath = undefined
      }
    }
  }

  return {
    itemId: ticket.data.itemId,
    media: {
      storagePath: ticket.data.path,
      posterPath,
      width: prepared.width,
      height: prepared.height,
      durationMs: prepared.durationMs ?? undefined,
    },
    files,
  }
}
