'use client'

import { useCallback, useEffect, useId, useImperativeHandle, useOptimistic, useRef, useState, useTransition } from 'react'
import { closestCenter, DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { LuCamera, LuImagePlus } from 'react-icons/lu'
import { MediaDropzone } from '@/features/menu-editor/components/media-dropzone'
import { MediaFocal } from '@/features/menu-editor/components/media-focal'
import { MediaTile } from '@/features/menu-editor/components/media-item'
import { panelAnnouncements, PANEL_DRAG_INSTRUCTIONS, usePanelSensors } from '@/features/menu-editor/lib/dnd'
import { toast } from '@/components/ui/toast'
import { MAX_MEDIA_PER_ITEM, MEDIA_LIMITS } from '@/domain/media'
import type { OwnerMenuItemDTO } from '@/domain/menu'
import type { PendingMedia } from '@/lib/media/types'
import { publicMediaUrl } from '@/lib/media-url'
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
  variant = 'panel',
}: {
  itemId: string | null
  media: OwnerMenuItemDTO['media']
  ref?: React.Ref<MediaEditorHandle>
  onPendingChange?: (count: number) => void
  /** `mobile`: grade de 3 colunas e "Adicionar" com câmera (sheet do celular). */
  variant?: 'panel' | 'mobile'
}) {
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [error, setError] = useState<string | null>(null)
  const [transitionPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    media[0]?.id ?? null,
  )

  const savedMedia = [...media].sort((a, b) => a.position - b.position)
  const dndId = useId()
  const sensors = usePanelSensors()
  const [orderedSaved, setOrderedSaved] = useOptimistic(savedMedia)
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

  function reorderSaved(nextOrder: typeof savedMedia) {
    if (!itemId) return
    startTransition(async () => {
      setOrderedSaved(nextOrder)
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

  // A ordem gravada só troca entre gravadas; a pendente só entre pendentes.
  // A primeira de todas é a capa, a tela que abre o prato no feed.
  function handleSortEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const savedFrom = orderedSaved.findIndex((entry) => entry.id === activeId)
    const savedTo = orderedSaved.findIndex((entry) => entry.id === overId)
    if (savedFrom >= 0 && savedTo >= 0) {
      reorderSaved(arrayMove(orderedSaved, savedFrom, savedTo))
      return
    }
    const pendingFrom = pendingMedia.findIndex((entry) => entry.localId === activeId)
    const pendingTo = pendingMedia.findIndex((entry) => entry.localId === overId)
    if (pendingFrom >= 0 && pendingTo >= 0) setPendingMedia((current) => arrayMove(current, pendingFrom, pendingTo))
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
  const tileIds = [...orderedSaved.map((entry) => entry.id), ...pendingMedia.map((entry) => entry.localId)]
  const coverId = tileIds[0] ?? null
  const describeTile = (id: UniqueIdentifier) => `Mídia ${tileIds.indexOf(String(id)) + 1}`
  const failed = pendingMedia.filter((entry) => entry.status === 'error' && entry.error)

  return (
    <div className={`tv-media${variant === 'mobile' ? ' is-mobile' : ''}`}>
      <MediaDropzone onFiles={handleFiles} acceptedTypes={ACCEPTED_TYPES} disabled={busy} remaining={remainingSlots}>
        {(openPicker) => (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSortEnd}
            accessibility={{ announcements: panelAnnouncements(describeTile, describeTile), screenReaderInstructions: PANEL_DRAG_INSTRUCTIONS }}
          >
            <SortableContext items={tileIds} strategy={rectSortingStrategy}>
              <div className="tv-media-grid">
                {orderedSaved.map((entry) => (
                  <MediaTile
                    key={entry.id}
                    id={entry.id}
                    title={entry.kind === 'video' ? 'Vídeo' : 'Foto'}
                    previewUrl={entry.kind === 'image' ? publicMediaUrl('image', entry.storagePath) : entry.posterPath ? publicMediaUrl('image', entry.posterPath) : null}
                    state="ready"
                    progress={100}
                    cover={entry.id === coverId}
                    busy={busy}
                    selected={selectedMedia?.id === entry.id}
                    onSelect={() => setSelectedId(entry.id)}
                    onRemove={() => removeSaved(entry.id)}
                    onMakeCover={() => reorderSaved([entry, ...orderedSaved.filter((other) => other.id !== entry.id)])}
                  />
                ))}
                {pendingMedia.map((entry) => (
                  <MediaTile
                    key={entry.localId}
                    id={entry.localId}
                    title={entry.file.name}
                    previewUrl={entry.kind === 'image' ? entry.previewUrl : null}
                    state={entry.status}
                    progress={entry.progress}
                    cover={entry.localId === coverId}
                    busy={busy}
                    onRemove={() => removePending(entry.localId)}
                  />
                ))}
                {remainingSlots > 0 ? (
                  <button type="button" className="tv-media-add" disabled={busy} onClick={openPicker} aria-label={`Adicionar fotos ou vídeos. Cabem mais ${remainingSlots}.`}>
                    {variant === 'mobile' ? <LuCamera aria-hidden="true" /> : <LuImagePlus aria-hidden="true" />}Adicionar
                  </button>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </MediaDropzone>

      {selectedMedia ? <MediaFocal key={selectedMedia.id} media={selectedMedia} /> : null}

      {pendingMedia.length > 0 ? (
        <p className="tv-media-note">
          {pendingMedia.length === 1 ? '1 arquivo ainda não foi enviado.' : `${pendingMedia.length} arquivos ainda não foram enviados.`}{' '}
          Eles sobem quando você salvar o item.
        </p>
      ) : null}
      {failed.map((entry) => <p key={entry.localId} role="alert" className="tv-pfield-error">“{entry.file.name}”: {entry.error}</p>)}
      {error ? <p role="alert" className="tv-pfield-error">{error}</p> : null}
    </div>
  )
}
