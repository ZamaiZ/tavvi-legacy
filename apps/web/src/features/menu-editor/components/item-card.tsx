'use client'

import { LuImagePlus } from 'react-icons/lu'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { firstMedia, focalPosition, mediaPreviewUrl, priceLabel } from '../lib/item-display'
import { ItemActionsMenu } from './item-actions-menu'
import { ItemContextMenu } from './item-context-menu'
import { ItemDialogs } from './item-dialogs'
import { ReorderButtons } from './reorder-buttons'
import { useItemActions } from './use-item-actions'

// Cartão da Grade (README §7.5, item 8): imagem 4:3, nome, preço e switch.
// O ⋯ aparece sobre a imagem no hover/foco e abre o mesmo menu da Lista.
export function ItemCard({
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
  const media = firstMedia(item)
  const url = media ? mediaPreviewUrl(media) : null
  const image = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {media && url ? <img src={url} alt="" loading="lazy" style={{ objectPosition: focalPosition(media) }} /> : null}
      {item.missingMedia ? <span className="tv-nophoto is-lg"><LuImagePlus aria-hidden="true" />Sem foto</span> : null}
    </>
  )

  return (
    <ItemContextMenu
      item={item}
      categories={categories}
      actions={actions}
      disabled={!canEdit}
      render={<article className={`tv-gcard${item.isVisible ? '' : ' is-hidden'}`} />}
    >
      <div className="tv-gcard-media">
        {canEdit ? (
          <button type="button" className="tv-gcard-image" aria-label={`Editar ${item.name}`} onClick={() => actions.setEditOpen(true)}>{image}</button>
        ) : (
          <div className="tv-gcard-image">{image}</div>
        )}
        {canEdit ? <ItemActionsMenu item={item} categories={categories} actions={actions} triggerClassName="tv-gcard-more" /> : null}
        {canEdit && reorderMode ? (
          <div className="tv-gcard-order">
            <ReorderButtons
              label={`item ${item.name}`}
              orientation="horizontal"
              isFirst={actions.isFirst}
              isLast={actions.isLast}
              disabled={actions.pending}
              onUp={() => actions.reorder(-1)}
              onDown={() => actions.reorder(1)}
            />
          </div>
        ) : null}
      </div>
      <div className="tv-gcard-body">
        <strong>{item.name}</strong>
        <div className="tv-gcard-row">
          <span className={actions.available ? undefined : 'is-soldout'}>{priceLabel(item)}</span>
          {canEdit ? (
            <Switch
              checked={actions.available}
              disabled={actions.pending}
              onCheckedChange={(next) => actions.toggleAvailability(next)}
              aria-label={`${item.name} disponível`}
            />
          ) : (
            <small>{actions.available ? 'Disponível' : 'Esgotado'}</small>
          )}
        </div>
      </div>
      {canEdit ? <ItemDialogs item={item} categories={categories} actions={actions} /> : null}
    </ItemContextMenu>
  )
}
