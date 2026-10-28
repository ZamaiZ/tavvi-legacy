'use client'

import { useId, useState } from 'react'
import { closestCenter, DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { LuCamera, LuImagePlus } from 'react-icons/lu'
import { MAX_MEDIA_PER_ITEM } from '@/domain/media'
import { publicMediaUrl } from '@/lib/media-url'
import { LIFT_DROP_ANIMATION, panelAnnouncements, PANEL_DRAG_INSTRUCTIONS, usePanelSensors } from '../lib/dnd'
import type { MediaDraft } from '../lib/item-draft'
import { ACCEPTED_MEDIA_TYPES } from '../lib/media-prep'
import { ItemMediaTile, ItemMediaTileOverlay, type TileStatus } from './item-media-tile'
import { MediaDropzone } from './media-dropzone'

function previewOf(media: MediaDraft): string | null {
  if (media.source.type === 'new') return media.source.previewUrl
  if (media.source.kind === 'image') return publicMediaUrl('image', media.source.storagePath)
  return media.source.posterPath ? publicMediaUrl('image', media.source.posterPath) : null
}

function statusOf(media: MediaDraft): { status: TileStatus; progress: number } {
  if (media.source.type === 'saved') return { status: 'ready', progress: 100 }
  if (media.source.upload === 'uploading') return { status: 'uploading', progress: 100 }
  const prep = media.source.prep
  if (prep.status === 'preparing') return { status: 'preparing', progress: prep.progress }
  if (prep.status === 'queued') return { status: 'queued', progress: 0 }
  if (prep.status === 'error') return { status: 'error', progress: 0 }
  return { status: 'ready', progress: 100 }
}

function titleOf(media: MediaDraft): string {
  if (media.source.type === 'new') return media.source.fileName
  return media.source.kind === 'video' ? 'Vídeo' : 'Foto'
}

// Grade de mídia do rascunho: salvas e novas numa lista só, arrastáveis
// entre si. Nada grava aqui — quem grava é o "Salvar" do item.
export function ItemMediaField({
  media,
  disabled,
  variant = 'panel',
  notices,
  inspecting,
  blockWhileInspecting = false,
  error,
  onAddFiles,
  onRemove,
  onMove,
  onMakeCover,
}: {
  media: MediaDraft[]
  disabled: boolean
  variant?: 'panel' | 'mobile'
  notices: string[]
  inspecting: boolean
  blockWhileInspecting?: boolean
  error?: string
  onAddFiles: (files: File[]) => void
  onRemove: (key: string) => void
  onMove: (activeKey: string, overKey: string) => void
  onMakeCover: (key: string) => void
}) {
  const dndId = useId()
  const sensors = usePanelSensors()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const remaining = Math.max(0, MAX_MEDIA_PER_ITEM - media.length)
  const controlsDisabled = disabled || (blockWhileInspecting && inspecting)
  const keys = media.map((entry) => entry.key)
  const active = media.find((entry) => entry.key === activeKey) ?? null
  const newCount = media.filter((entry) => entry.source.type === 'new').length
  const failed = media.filter((entry) => entry.source.type === 'new' && entry.source.prep.status === 'error')
  const describe = (id: UniqueIdentifier) => `Mídia ${keys.indexOf(String(id)) + 1}`

  function onDragStart({ active: dragged }: DragStartEvent) {
    setActiveKey(String(dragged.id))
  }

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    setActiveKey(null)
    if (over && dragged.id !== over.id) onMove(String(dragged.id), String(over.id))
  }

  return (
    <div className={`tv-media${variant === 'mobile' ? ' is-mobile' : ''}`} aria-busy={inspecting || undefined}>
      <MediaDropzone onFiles={onAddFiles} acceptedTypes={ACCEPTED_MEDIA_TYPES} disabled={controlsDisabled} remaining={remaining}>
        {(openPicker) => (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveKey(null)}
            accessibility={{ announcements: panelAnnouncements(describe, describe), screenReaderInstructions: PANEL_DRAG_INSTRUCTIONS }}
          >
            <SortableContext items={keys} strategy={rectSortingStrategy}>
              <div className="tv-media-grid">
                {media.map((entry, index) => {
                  const { status, progress } = statusOf(entry)
                  return (
                    <ItemMediaTile
                      key={entry.key}
                      id={entry.key}
                      title={titleOf(entry)}
                      previewUrl={previewOf(entry)}
                      status={status}
                      progress={progress}
                      cover={index === 0}
                      disabled={controlsDisabled}
                      onRemove={() => onRemove(entry.key)}
                      onMakeCover={() => onMakeCover(entry.key)}
                    />
                  )
                })}
                {remaining > 0 ? (
                  <button type="button" className="tv-media-add" disabled={controlsDisabled} onClick={openPicker} aria-label={`Adicionar fotos ou vídeos. Cabem mais ${remaining}.`}>
                    {variant === 'mobile' ? <LuCamera aria-hidden="true" /> : <LuImagePlus aria-hidden="true" />}Adicionar
                  </button>
                ) : null}
              </div>
            </SortableContext>
            <DragOverlay className="tv-drag-overlay" dropAnimation={LIFT_DROP_ANIMATION}>
              {active ? <ItemMediaTileOverlay previewUrl={previewOf(active)} cover={media[0]?.key === active.key} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </MediaDropzone>

      {inspecting ? <p className="tv-media-note" role="status">Conferindo arquivos…</p> : null}
      {newCount > 0 ? (
        <p className="tv-media-note">
          {newCount === 1 ? '1 arquivo novo sobe' : `${newCount} arquivos novos sobem`} quando você salvar.
        </p>
      ) : null}
      {notices.length > 0 || failed.length > 0 || error ? (
        <ul className="tv-media-notices">
          {notices.map((notice) => <li key={notice} role="alert" className="tv-pfield-error">{notice}</li>)}
          {failed.map((entry) => (
            <li key={entry.key} role="alert" className="tv-pfield-error">
              {entry.source.type === 'new' && entry.source.prep.status === 'error' ? entry.source.prep.error : null}
            </li>
          ))}
          {error && failed.length === 0 ? <li role="alert" className="tv-pfield-error">{error}</li> : null}
        </ul>
      ) : null}
    </div>
  )
}
