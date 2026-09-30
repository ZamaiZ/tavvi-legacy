import type { OwnerMenuItemDTO } from '@/domain/menu'
import { reorderItemsAction, updateItemAction } from '@/server/actions/menu'
import type { ActionResult } from '@/server/actions/result'

type ItemChanges = Partial<Pick<OwnerMenuItemDTO, 'categoryId' | 'name' | 'basePriceCents' | 'isVisible' | 'isAvailable'>>

// O schema de atualização exige o registro inteiro de volta.
export function itemPayload(item: OwnerMenuItemDTO, changes: ItemChanges = {}) {
  return {
    itemId: item.id,
    categoryId: changes.categoryId ?? item.categoryId,
    name: changes.name ?? item.name,
    description: item.description ?? undefined,
    basePriceCents: changes.basePriceCents ?? item.basePriceCents,
    dietaryTags: item.dietaryTags,
    isVisible: changes.isVisible ?? item.isVisible,
    isAvailable: changes.isAvailable ?? item.isAvailable,
  }
}

export function saveItemOrder(restaurantId: string, ids: string[]): Promise<ActionResult> {
  return reorderItemsAction({ restaurantId, order: ids.map((id, position) => ({ id, position })) })
}

// Não há "mover" no servidor: troca a categoria e renumera as duas listas.
// `sourceIds` já vem sem o item; `targetIds` com o item no lugar final.
export async function moveItemToCategory({
  restaurantId,
  item,
  categoryId,
  sourceIds,
  targetIds,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO
  categoryId: string
  sourceIds: string[]
  targetIds: string[]
}): Promise<ActionResult> {
  const updated = await updateItemAction(itemPayload(item, { categoryId }))
  if (!updated.ok) return updated
  if (sourceIds.length > 0) {
    const source = await saveItemOrder(restaurantId, sourceIds)
    if (!source.ok) return source
  }
  return saveItemOrder(restaurantId, targetIds)
}
