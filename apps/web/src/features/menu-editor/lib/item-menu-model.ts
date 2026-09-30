import type { IconType } from 'react-icons'
import { LuCircleCheck, LuCircleSlash, LuEye, LuEyeOff, LuPencil, LuTrash2 } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import type { ItemActions } from '../components/use-item-actions'

export type ItemMenuEntry = {
  key: 'edit' | 'availability' | 'visibility' | 'delete'
  label: string
  icon: IconType
}

// Rótulos, ícones e condições do menu do item. O "…" e o botão direito leem
// daqui, para nunca oferecerem ações diferentes (spec de componentes §4.2).
export function itemMenuModel(
  item: Pick<OwnerMenuItemDTO, 'isVisible' | 'categoryId'>,
  available: boolean,
  categories: Pick<OwnerMenuCategoryDTO, 'id' | 'name'>[],
) {
  const primary: ItemMenuEntry[] = [
    { key: 'edit', label: 'Editar', icon: LuPencil },
    { key: 'availability', label: available ? 'Marcar como esgotado' : 'Marcar como disponível', icon: available ? LuCircleSlash : LuCircleCheck },
    { key: 'visibility', label: item.isVisible ? 'Ocultar' : 'Mostrar', icon: item.isVisible ? LuEyeOff : LuEye },
  ]
  const moveTargets = categories.filter((category) => category.id !== item.categoryId).map(({ id, name }) => ({ id, name }))
  const remove: ItemMenuEntry = { key: 'delete', label: 'Excluir', icon: LuTrash2 }
  return { primary, moveTargets, remove }
}

export function runItemMenuEntry(key: ItemMenuEntry['key'], actions: ItemActions) {
  if (key === 'edit') actions.setEditOpen(true)
  else if (key === 'availability') actions.toggleAvailability(!actions.available)
  else if (key === 'visibility') actions.toggleVisibility()
  else actions.setDeleteOpen(true)
}
