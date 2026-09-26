import { MEDIA_LIMITS } from '@/domain/media'
import { compressImage } from '@/lib/media/compress-image'
import { compressVideo } from '@/lib/media/compress-video'
import type { PendingMedia } from '@/lib/media/types'
import { formatFileSize } from '@/lib/format'
import { captureVideoPoster, readVideoDurationMs, uploadToSignedUrl } from '@/lib/upload'
import { createUploadTicketAction, registerItemMediaAction } from '@/server/actions/media'

type PendingMediaUpdater = (localId: string, changes: Partial<PendingMedia>) => void
const MAX_VIDEO_DURATION_MS = 15_000

async function uploadPoster(itemId: string, file: File): Promise<string | undefined> {
  const poster = await captureVideoPoster(file)
  if (!poster || !(MEDIA_LIMITS.image.mimes as readonly string[]).includes(poster.type)) return undefined

  const ticket = await createUploadTicketAction({
    itemId,
    kind: 'image',
    mimeType: poster.type,
  })
  if (!ticket.ok) return undefined

  try {
    await uploadToSignedUrl(ticket.data.signedUrl, poster, poster.type)
    return ticket.data.path
  } catch {
    return undefined
  }
}

async function uploadOne(itemId: string, pendingItem: PendingMedia, updatePending: PendingMediaUpdater): Promise<boolean> {
  const { localId, file, kind } = pendingItem

  try {
    updatePending(localId, { status: 'compressing', progress: 0, error: undefined })

    let blob: Blob = file
    let width: number | undefined
    let height: number | undefined
    let durationMs: number | null = null

    if (kind === 'image') {
      const result = await compressImage(file)
      blob = result.blob
      width = result.width
      height = result.height
    } else {
      durationMs = await readVideoDurationMs(file)
      if (durationMs !== null && durationMs > MAX_VIDEO_DURATION_MS) {
        updatePending(localId, { status: 'error', error: 'Mais de 15 segundos.' })
        return false
      }

      const result = await compressVideo(file, (progress) => updatePending(localId, { progress }))
      if (result) {
        blob = result.blob
        width = result.width
        height = result.height
      }
    }

    const maxBytes = MEDIA_LIMITS[kind].maxBytes
    if (blob.size > maxBytes) {
      updatePending(localId, {
        status: 'error',
        error: `Ficou em ${formatFileSize(blob.size)}, acima do limite.`,
      })
      return false
    }

    updatePending(localId, { status: 'uploading', progress: 0 })
    const posterPath = kind === 'video' ? await uploadPoster(itemId, file) : undefined
    const mimeType = blob.type || file.type
    const ticket = await createUploadTicketAction({ itemId, kind, mimeType })
    if (!ticket.ok) {
      updatePending(localId, { status: 'error', error: ticket.error })
      return false
    }

    await uploadToSignedUrl(ticket.data.signedUrl, blob, mimeType)
    updatePending(localId, { progress: 100 })

    const result = await registerItemMediaAction({
      itemId,
      kind,
      storagePath: ticket.data.path,
      posterPath,
      width,
      height,
      durationMs: durationMs ?? undefined,
    })
    if (!result.ok) {
      updatePending(localId, { status: 'error', error: result.error })
      return false
    }

    updatePending(localId, { status: 'ready', progress: 100 })
    return true
  } catch {
    updatePending(localId, { status: 'error', error: 'Falha ao enviar. Tente de novo.' })
    return false
  }
}

export async function uploadPendingMedia(
  itemId: string,
  queue: PendingMedia[],
  updatePending: PendingMediaUpdater,
): Promise<boolean> {
  let allSucceeded = true

  for (const pendingItem of queue) {
    if (!(await uploadOne(itemId, pendingItem, updatePending))) allSucceeded = false
  }

  return allSucceeded
}
