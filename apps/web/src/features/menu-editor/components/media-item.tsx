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
import type { MediaStatus } from '@/lib/media/types'

// Menus e listas portados mandam os eventos pela árvore do React até o
// tile, mas não estão dentro dele no DOM: esses nunca iniciam arrasto.
const fromInside = (event: SyntheticEvent) => event.currentTarget.contains(event.target as Node)

// Tile quadrado da grade de mídia (README §7.5, "Editar item"). Serve mídia
// GRAVADA e PENDENTE: no feed a ordem das duas é a mesma ordem de telas.
//
// O tile inteiro arrasta com o mouse ou o toque; o botão interno seleciona
// para o enquadramento e é o ativador do teclado (espaço pega, Enter
// seleciona). O "remover" nunca inicia arrasto. No desktop, o botão direito
// oferece "Definir como capa" (só para mídia gravada) e "Remover".
export function MediaTile({
  id,
  title,
  previewUrl,
  state,
  progress,
  cover,
  busy,
  selected = false,
  onSelect,
  onRemove,
  onMakeCover,
}: {
  id: string
  title: string
  /** `null` num vídeo sem capa: cai no ícone de filme. */
  previewUrl: string | null
  state: MediaStatus
  progress: number
  cover: boolean
  busy: boolean
  selected?: boolean
  onSelect?: () => void
  onRemove: () => void
  /** Leva a mídia para a primeira posição, a mesma ação do arrastar. */
  onMakeCover?: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: busy })
  const working = state === 'uploading' || state === 'compressing'
  const label = `${title}${cover ? ' (capa)' : ''}`

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`tv-media-tile${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}${state === 'error' ? ' is-error' : ''}`}
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
          disabled={busy}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={onRemove}
        >
          <LuX aria-hidden="true" />
        </button>
        {working ? (
          <span className="tv-media-progress" role="progressbar" aria-label={`Enviando ${title}`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </span>
        ) : null}
      </ContextMenuTrigger>
      <ContextMenuContent width="sm" aria-label={`Ações de ${title}`}>
        <ContextMenuItem disabled={cover || !onMakeCover || busy} onClick={onMakeCover}><LuImageUp aria-hidden="true" /><span>Definir como capa</span></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" disabled={busy} onClick={onRemove}><LuTrash2 aria-hidden="true" /><span>Remover</span></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
