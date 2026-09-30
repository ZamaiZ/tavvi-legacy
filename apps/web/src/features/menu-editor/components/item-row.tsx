'use client'

import { useRef, useState } from 'react'
import { LuImagePlus, LuPencil } from 'react-icons/lu'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { mediaSummary, priceLabel } from '../lib/item-display'
import { ItemActionsMenu } from './item-actions-menu'
import { ItemContextMenu } from './item-context-menu'
import { ItemDialogs } from './item-dialogs'
import { ItemThumb } from './item-thumb'
import { ReorderButtons } from './reorder-buttons'
import { useItemActions } from './use-item-actions'

// Linha do item na Lista e no Índice (README §7.5, item 6).
export function ItemRow({
  restaurantId,
  item,
  siblings,
  categories,
  canEdit,
  reorderMode,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  siblings: OwnerMenuItemDTO[]
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
  reorderMode: boolean
}) {
  const actions = useItemActions({ restaurantId, item, siblings, categories })
  const [menuOpen, setMenuOpen] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  function clearLongPress() {
    if (longPress.current) clearTimeout(longPress.current)
    longPress.current = null
  }

  // Toque: segurar abre o menu; deslizar à direita alterna a
  // disponibilidade; à esquerda pede para excluir.
  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!canEdit || reorderMode || (event.target as HTMLElement).closest('button,input,[role="switch"],a')) return
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    longPressFired.current = false
    longPress.current = setTimeout(() => {
      longPressFired.current = true
      setMenuOpen(true)
    }, 480)
  }

  function onTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    clearLongPress()
    const start = touchStart.current
    touchStart.current = null
    if (longPressFired.current || !start) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    if (dx > 0) actions.toggleAvailability(!actions.available)
    else if (dx <= -88) actions.setDeleteOpen(true)
  }

  return (
    <ItemContextMenu
      item={item}
      categories={categories}
      actions={actions}
      disabled={!canEdit}
      render={
        <div
          className={`tv-item${item.isVisible ? '' : ' is-hidden'}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { clearLongPress(); touchStart.current = null }}
        />
      }
    >
      <ItemThumb item={item} />
      <div className="tv-item-copy">
        <div className="tv-item-line">
          <strong>{item.name}</strong>
          {!item.isVisible ? <span className="tv-item-flag">Oculto</span> : null}
          {item.missingMedia ? <span className="tv-nophoto"><LuImagePlus aria-hidden="true" />Sem foto</span> : null}
        </div>
        {item.description ? <p className="tv-item-desc">{item.description}</p> : null}
        <div className="tv-item-meta">
          <span className={`tv-item-price${actions.available ? '' : ' is-soldout'}`}>{priceLabel(item)}</span>
          <span>{mediaSummary(item)}</span>
          {item.dietaryTags.map((tag) => <span key={tag} className="tv-item-tag">{tag}</span>)}
        </div>
      </div>
      <div className="tv-item-actions">
        {canEdit ? (
          <label className="tv-avail">
            <span>{actions.available ? 'Disponível' : 'Esgotado'}</span>
            <Switch
              checked={actions.available}
              disabled={actions.pending}
              onCheckedChange={(next) => actions.toggleAvailability(next)}
              aria-label={`${item.name} disponível`}
            />
          </label>
        ) : (
          <span className="tv-avail-text">{actions.available ? 'Disponível' : 'Esgotado'}</span>
        )}
        {canEdit && reorderMode ? (
          <ReorderButtons
            label={`item ${item.name}`}
            isFirst={actions.isFirst}
            isLast={actions.isLast}
            disabled={actions.pending}
            onUp={() => actions.reorder(-1)}
            onDown={() => actions.reorder(1)}
          />
        ) : null}
        {canEdit ? (
          <button type="button" className="tv-picon" aria-label={`Editar ${item.name}`} onClick={() => actions.setEditOpen(true)}>
            <LuPencil aria-hidden="true" />
          </button>
        ) : null}
        {canEdit ? <ItemActionsMenu item={item} categories={categories} actions={actions} open={menuOpen} onOpenChange={setMenuOpen} /> : null}
      </div>
      {canEdit ? <ItemDialogs item={item} categories={categories} actions={actions} /> : null}
    </ItemContextMenu>
  )
}
