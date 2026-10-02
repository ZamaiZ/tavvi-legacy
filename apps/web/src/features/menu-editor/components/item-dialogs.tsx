'use client'

import { LuTrash2 } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { ItemEditorPanel } from './item-editor-panel'
import type { ItemActions } from './use-item-actions'

// Irmãos do menu, não filhos: diálogo dentro de menu some junto com ele.
export function ItemDialogs({
  restaurantId,
  item,
  categories,
  actions,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  actions: ItemActions
}) {
  return (
    <>
      <ItemEditorPanel
        restaurantId={restaurantId}
        item={item}
        categoryId={item.categoryId}
        categories={categories}
        open={actions.editOpen}
        onOpenChange={actions.setEditOpen}
      />
      <PanelConfirm
        open={actions.deleteOpen}
        onOpenChange={actions.setDeleteOpen}
        icon={<LuTrash2 />}
        title={`Excluir ${item.name}?`}
        description="As variações e as fotos deste item saem junto. Isto não pode ser desfeito."
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        pending={actions.running === 'delete'}
        destructive
        onConfirm={actions.remove}
      />
    </>
  )
}
