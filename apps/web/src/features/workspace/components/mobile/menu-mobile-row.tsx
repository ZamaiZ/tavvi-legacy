'use client'

import { useState } from 'react'
import { LuImagePlus, LuTrash2 } from 'react-icons/lu'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { ItemActionsMenu } from '@/features/menu-editor/components/item-actions-menu'
import { useItemActions } from '@/features/menu-editor/components/use-item-actions'
import { useRowGestures } from '@/features/menu-editor/components/use-row-gestures'
import { firstMedia, focalPosition, mediaPreviewUrl, priceLabel } from '@/features/menu-editor/lib/item-display'
import { PanelConfirm } from '../panel-confirm'
import { ItemEditSheet } from './item-sheet'

// Foto de 48 px. Sem mídia: tracejada com image-plus em warn. Vídeo sem
// capa: a hachura dourada.
function MobileThumb({ item }: { item: OwnerMenuItemDTO }) {
  const media = firstMedia(item)
  const url = media ? mediaPreviewUrl(media) : null
  if (media && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={48} height={48} loading="lazy" className="tv-mthumb" style={{ objectPosition: focalPosition(media) }} />
  }
  if (media) return <span className="tv-mthumb is-video" aria-hidden="true" />
  return <span className="tv-mthumb is-empty" aria-hidden="true"><LuImagePlus /></span>
}

// Linha do item no celular (Tavvi Mobile.dc.html, bMenu): foto, nome, preço
// e o switch de disponibilidade. Tocar abre "Editar item"; segurar abre o
// menu do item; deslizar alterna a disponibilidade ou pede para excluir.
export function MenuMobileRow({
  restaurantId,
  item,
  siblings,
  categories,
  canEdit,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  /** Itens da categoria na ordem do servidor, sem filtro. */
  siblings: OwnerMenuItemDTO[]
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
}) {
  const actions = useItemActions({ restaurantId, item, siblings, categories })
  const [menuOpen, setMenuOpen] = useState(false)
  const gestures = useRowGestures({
    enabled: canEdit,
    ignore: '[role="switch"],[data-slot="switch"]',
    onLongPress: () => setMenuOpen(true),
    onSwipeRight: () => actions.toggleAvailability(!actions.available, true),
    onSwipeLeft: () => actions.setDeleteOpen(true),
  })

  const content = (
    <>
      <MobileThumb item={item} />
      <span className="tv-mrow-copy">
        <strong>{item.name}</strong>
        <span className="tv-mrow-meta">
          <span className={actions.available ? undefined : 'is-soldout'}>{priceLabel(item)}</span>
          {item.missingMedia ? <span className="tv-mrow-nophoto">Sem foto</span> : null}
          {!item.isVisible ? <span className="tv-mrow-hidden">Oculto</span> : null}
        </span>
      </span>
    </>
  )

  return (
    <div className={`tv-mrow${item.isVisible ? '' : ' is-hidden'}`} {...gestures}>
      {canEdit ? (
        <button type="button" className="tv-mrow-main" aria-haspopup="dialog" onClick={() => actions.setEditOpen(true)}>{content}</button>
      ) : (
        <div className="tv-mrow-main">{content}</div>
      )}
      {canEdit ? (
        <Switch size="lg" checked={actions.available} onCheckedChange={(next) => actions.toggleAvailability(next, true)} aria-label={`${item.name} disponível`} />
      ) : (
        <span className={`tv-mrow-state${actions.available ? '' : ' is-soldout'}`}>{actions.available ? 'Disponível' : 'Esgotado'}</span>
      )}
      {canEdit ? (
        <>
          <ItemActionsMenu item={item} categories={categories} actions={actions} open={menuOpen} onOpenChange={setMenuOpen} triggerClassName="tv-mrow-menu" touch />
          <ItemEditSheet item={item} categories={categories} open={actions.editOpen} onOpenChange={actions.setEditOpen} onDelete={actions.remove} />
          <PanelConfirm
            open={actions.deleteOpen}
            onOpenChange={actions.setDeleteOpen}
            icon={<LuTrash2 />}
            title={`Excluir ${item.name}?`}
            description="As variações e as fotos deste item saem junto. Isto não pode ser desfeito."
            confirmLabel="Excluir"
            destructive
            onConfirm={actions.remove}
          />
        </>
      ) : null}
    </div>
  )
}
