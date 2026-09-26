'use client'

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useTransition } from 'react'
import { RiImageLine } from 'react-icons/ri'
import { MediaDropzone } from '@/features/menu-editor/components/media-dropzone'
import { MediaFocal } from '@/features/menu-editor/components/media-focal'
import { MediaItem } from '@/features/menu-editor/components/media-item'
import { AttachmentGroup } from '@/components/ui/attachment'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { toast } from '@/components/ui/toast'
import { MAX_MEDIA_PER_ITEM, MEDIA_LIMITS } from '@/domain/media'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import type { PendingMedia } from '@/lib/media/types'
import { publicMediaUrl } from '@/lib/media-url'
import { formatFileSize } from '@/lib/format'
import { uploadPendingMedia } from '@/features/menu-editor/components/media-upload'
import {
  deleteItemMediaAction,
  reorderItemMediaAction,
} from '@/server/actions/media'

const ACCEPTED_TYPES = [
  ...MEDIA_LIMITS.image.mimes,
  ...MEDIA_LIMITS.video.mimes,
] as readonly string[]

export type MediaEditorHandle = {
  /** Sobe tudo o que está pendente. `false` se alguma falhou. */
  uploadPending: (itemId: string) => Promise<boolean>
  /** Quantas pendentes existem agora. O diálogo usa para avisar ao fechar. */
  getPendingCount: () => number
}

// O editor de mídia, reescrito na Fase 5 sobre STAGING.
//
// Até a Fase 4 cada arquivo subia no instante em que era escolhido. Isso
// gravava arquivo de quem desistiu do item no meio, e — pior — tornava
// impossível anexar mídia ao CRIAR um item, porque `registerItemMedia` exige
// um `itemId` que ainda não existe.
//
// Agora os arquivos ficam em blob até o dono confirmar. `itemId` nulo é
// exatamente o caso de criação: o editor acumula e quem sobe é o diálogo,
// depois que o item nasce.
export function MediaEditor({
  itemId,
  media,
  ref,
  onPendingChange,
}: {
  itemId: string | null
  media: OwnerMenuItemDTO['media']
  ref?: React.Ref<MediaEditorHandle>
  onPendingChange?: (count: number) => void
}) {
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [error, setError] = useState<string | null>(null)
  const [transitionPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    media[0]?.id ?? null,
  )

  const savedMedia = [...media].sort((a, b) => a.position - b.position)
  const remainingSlots = Math.max(
    0,
    MAX_MEDIA_PER_ITEM - savedMedia.length - pendingMedia.length,
  )
  const selectedMedia =
    savedMedia.find((entry) => entry.id === selectedId) ??
    savedMedia[0] ??
    null

  // `useRef` do array para a limpeza no desmonte enxergar o valor ATUAL. Um
  // efeito com `[]` de dependências fecharia sobre o array vazio inicial e
  // não revogaria nada — e um dono que troca dez fotos numa sessão seguraria
  // dez blobs na memória do celular.
  const pendingMediaRef = useRef<PendingMedia[]>([])
  pendingMediaRef.current = pendingMedia

  useEffect(() => {
    return () => {
      for (const pendingItem of pendingMediaRef.current) {
        URL.revokeObjectURL(pendingItem.previewUrl)
      }
    }
  }, [])

  useEffect(() => {
    onPendingChange?.(pendingMedia.length)
  }, [pendingMedia.length, onPendingChange])

  const updatePending = useCallback(
    (localId: string, changes: Partial<PendingMedia>) => {
      setPendingMedia((current) =>
        current.map((pendingItem) =>
          pendingItem.localId === localId
            ? { ...pendingItem, ...changes }
            : pendingItem,
        ),
      )
    },
    [],
  )

  function handleFiles(files: File[]) {
    setError(null)

    const newMedia: PendingMedia[] = []
    let availableSlots = remainingSlots

    for (const file of files) {
      // Recusado AQUI, antes de qualquer processamento. Errar o formato não
      // deve nem acender indicador de carregamento.
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" não é uma foto nem um vídeo aceito.`)
        continue
      }
      if (availableSlots <= 0) {
        setError(`Este prato já chegou a ${MAX_MEDIA_PER_ITEM} telas.`)
        break
      }

      newMedia.push({
        localId: crypto.randomUUID(),
        file: file,
        previewUrl: URL.createObjectURL(file),
        kind: file.type.startsWith('video/') ? 'video' : 'image',
        status: 'pending',
        progress: 0,
      })
      availableSlots -= 1
    }

    if (newMedia.length > 0) {
      setPendingMedia((current) => [...current, ...newMedia])
    }
  }

  function removePending(localId: string) {
    setPendingMedia((current) => {
      const target = current.find((pendingItem) => pendingItem.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((pendingItem) => pendingItem.localId !== localId)
    })
  }

  function movePending(index: number, direction: -1 | 1) {
    setPendingMedia((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.length) return current
      const nextOrder = [...current]
      const [moved] = nextOrder.splice(index, 1)
      nextOrder.splice(destination, 0, moved)
      return nextOrder
    })
  }

  function moveSaved(index: number, direction: -1 | 1) {
    if (!itemId) return
    const destination = index + direction
    if (destination < 0 || destination >= savedMedia.length) return

    const nextOrder = [...savedMedia]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(destination, 0, moved)

    startTransition(async () => {
      const result = await reorderItemMediaAction({
        itemId,
        order: nextOrder.map((entry, position) => ({
          id: entry.id,
          position,
        })),
      })
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
    })
  }

  function removeSaved(mediaId: string) {
    startTransition(async () => {
      const result = await deleteItemMediaAction(mediaId)
      if (!result.ok) toast.add({ title: result.error, type: 'error' })
    })
  }

  useImperativeHandle(
    ref,
    () => ({
      getPendingCount: () =>
        pendingMediaRef.current.filter((pendingItem) => pendingItem.status !== 'ready').length,

      async uploadPending(targetItemId: string) {
        const queue = pendingMediaRef.current.filter(
          (pendingItem) => pendingItem.status !== 'ready',
        )
        if (queue.length === 0) return true

        setUploading(true)
        const allSucceeded = await uploadPendingMedia(targetItemId, queue, updatePending)

        setUploading(false)

        if (allSucceeded) {
          for (const pendingItem of pendingMediaRef.current) {
            URL.revokeObjectURL(pendingItem.previewUrl)
          }
          setPendingMedia([])
        }

        return allSucceeded
      },
    }),
    // `enviarUma` é recriada a cada render, mas só lê `pendentesRef` e props
    // estáveis. A lista de dependências fica vazia de propósito: o handle
    // precisa ser estável para o diálogo guardá-lo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const busy = transitionPending || uploading

  return (
    <div className="space-y-3">
      {savedMedia.length === 0 && pendingMedia.length === 0 ? (
        <PanelEmptyState
          density="compact"
          icon={<RiImageLine />}
          title="Este item ainda não tem mídia"
          description="Fotos e vídeos colocam o prato no feed público e são necessários para publicar o cardápio."
        />
      ) : (
        <AttachmentGroup className="scroll-fade-x scrollbar-none gap-2">
          {savedMedia.map((entry, index) => (
            <div key={entry.id} className="flex flex-col gap-2">
              <MediaItem
                title={entry.kind === 'video' ? 'Vídeo' : 'Foto'}
                previewUrl={
                  entry.kind === 'image'
                    ? publicMediaUrl('image', entry.storagePath)
                    : entry.posterPath
                      ? publicMediaUrl('image', entry.posterPath)
                      : null
                }
                kind={entry.kind}
                state="ready"
                progress={100}
                first={index === 0}
                last={index === savedMedia.length - 1 && pendingMedia.length === 0}
                busy={busy}
                selected={selectedMedia?.id === entry.id}
                onSelect={() => setSelectedId(entry.id)}
                onMoveUp={() => moveSaved(index, -1)}
                onMoveDown={() => moveSaved(index, 1)}
                onRemove={() => removeSaved(entry.id)}
              />
            </div>
          ))}

          {pendingMedia.map((pendingItem, index) => (
            <MediaItem
              key={pendingItem.localId}
              title={pendingItem.file.name}
              description={formatFileSize(pendingItem.file.size)}
              previewUrl={pendingItem.kind === 'image' ? pendingItem.previewUrl : null}
              kind={pendingItem.kind}
              state={pendingItem.status}
              progress={pendingItem.progress}
              mediaError={pendingItem.error}
              first={savedMedia.length === 0 && index === 0}
              last={index === pendingMedia.length - 1}
              busy={busy}
              onMoveUp={() => movePending(index, -1)}
              onMoveDown={() => movePending(index, 1)}
              onRemove={() => removePending(pendingItem.localId)}
            />
          ))}
        </AttachmentGroup>
      )}

      {selectedMedia ? <MediaFocal key={selectedMedia.id} media={selectedMedia} /> : null}

      <MediaDropzone
        onFiles={handleFiles}
        acceptedTypes={ACCEPTED_TYPES}
        disabled={busy}
        remaining={remainingSlots}
      />

      {pendingMedia.length > 0 ? (
        <p className="text-small text-muted-foreground">
          {pendingMedia.length === 1
            ? '1 arquivo ainda não foi enviado.'
            : `${pendingMedia.length} arquivos ainda não foram enviados.`}{' '}
          Eles sobem quando você salvar o item.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
