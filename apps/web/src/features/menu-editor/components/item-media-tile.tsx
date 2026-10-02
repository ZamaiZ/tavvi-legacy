'use client'

import type { SyntheticEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuFilm, LuImageUp, LuTrash2, LuX } from 'react-icons/lu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

export type TileStatus = 'ready' | 'queued' | 'preparing' | 'uploading' | 'error'

// Menus portados mandam eventos pela árvore do React até o tile, mas não
// estão dentro dele no DOM: esses nunca iniciam arrasto.
const fromInside = (event: SyntheticEvent) => event.currentTarget.contains(event.target as Node)

function statusText(status: TileStatus, progress: number): string | null {
  if (status === 'queued') return 'Na fila'
  if (status === 'preparing') return `Preparando ${Math.round(progress)}%`
  if (status === 'uploading') return 'Enviando'
  if (status === 'error') return 'Não serve'
  return null
}

// Tile quadrado da grade de mídia. Mídia gravada e nova, na MESMA lista:
// no feed a ordem das duas é uma só. O tile inteiro arrasta (mouse e toque);
// o botão interno seleciona para o enquadramento e é o ativador do teclado.
export function ItemMediaTile({
  id,
  title,
  previewUrl,
  status,
  progress,
  cover,
  disabled,
  selected,
  onSelect,
  onRemove,
  onMakeCover,
}: {
  id: string
  title: string
  previewUrl: string | null
  status: TileStatus
  progress: number
  cover: boolean
  disabled: boolean
  selected: boolean
  onSelect?: () => void
  onRemove: () => void
  onMakeCover: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const label = `${title}${cover ? ' (capa)' : ''}`
  const text = statusText(status, progress)
  const working = status === 'preparing' || status === 'uploading'

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`tv-media-tile${selected ? ' is-selected' : ''}${isDragging ? ' is-placeholder' : ''}${status === 'error' ? ' is-error' : ''}`}
            onMouseDown={(event) => { if (fromInside(event)) listeners?.onMouseDown?.(event) }}
            onTouchStart={(event) => { if (fromInside(event)) listeners?.onTouchStart?.(event) }}
          />
        }
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="tv-media-select"
          {...attributes}
          aria-pressed={onSelect ? selected : undefined}
          aria-label={onSelect ? `${label}. Selecionar para ajustar o enquadramento` : label}
          onKeyDown={(event) => listeners?.onKeyDown?.(event)}
          onClick={onSelect}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previewUrl ? <img src={previewUrl} alt="" draggable={false} /> : <LuFilm aria-hidden="true" />}
        </button>
        {cover ? <span className="tv-media-cover" aria-hidden="true">Capa</span> : null}
        <button
          type="button"
          className="tv-media-remove"
          aria-label={`Remover ${title}`}
          disabled={disabled}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={onRemove}
        >
          <LuX aria-hidden="true" />
        </button>
        {text ? <span className="tv-media-status" aria-hidden="true">{text}</span> : null}
        {working ? (
          <span className="tv-media-progress" role="progressbar" aria-label={`${text}: ${title}`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${status === 'uploading' ? 100 : progress}%` }} />
          </span>
        ) : null}
      </ContextMenuTrigger>
      <ContextMenuContent width="sm" aria-label={`Ações de ${title}`}>
        <ContextMenuItem disabled={cover || disabled} onClick={onMakeCover}><LuImageUp aria-hidden="true" /><span>Definir como capa</span></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={disabled} onClick={onRemove}><LuTrash2 aria-hidden="true" /><span>Remover</span></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// A cópia que segue o cursor, inclinada. Sem sortable e sem menu.
export function ItemMediaTileOverlay({ previewUrl, cover }: { previewUrl: string | null; cover: boolean }) {
  return (
    <div className="tv-media-tile is-overlay tv-lift">
      <span className="tv-media-select">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {previewUrl ? <img src={previewUrl} alt="" draggable={false} /> : <LuFilm aria-hidden="true" />}
      </span>
      {cover ? <span className="tv-media-cover" aria-hidden="true">Capa</span> : null}
    </div>
  )
}
