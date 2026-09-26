'use server'

import * as dal from '@/server/dal/menu-write'
import { revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

// Todas estas chamavam `revalidatePath('/')` — o caminho de ORIGEM, que o
// proxy reescreve. A doc empacotada do Next manda passar o DESTINO, e é o
// que `revalidateRestaurant` faz. Ver `@/server/revalidate`.

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { createdId, ...revalidationTarget } = await dal.createCategory(input)
    revalidateRestaurant(revalidationTarget)
    return { id: createdId }
  })
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.updateCategory(input))
  })
}

export async function deleteCategoryAction(
  categoryId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.deleteCategory(categoryId))
  })
}

export async function reorderCategoriesAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.reorderCategories(input))
  })
}

export async function createItemAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { createdId, ...revalidationTarget } = await dal.createItem(input)
    revalidateRestaurant(revalidationTarget)
    return { id: createdId }
  })
}

export async function updateItemAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.updateItem(input))
  })
}

export async function deleteItemAction(itemId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.deleteItem(itemId))
  })
}

export async function reorderItemsAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.reorderItems(input))
  })
}

export async function setItemAvailabilityAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.setItemAvailability(input))
  })
}

export async function createVariantAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { createdId, ...revalidationTarget } = await dal.createVariant(input)
    revalidateRestaurant(revalidationTarget)
    return { id: createdId }
  })
}

export async function updateVariantAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.updateVariant(input))
  })
}

export async function deleteVariantAction(
  variantId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.deleteVariant(variantId))
  })
}
