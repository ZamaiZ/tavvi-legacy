'use server'

import * as dal from '@/server/dal/menu-write'
import * as saveDal from '@/server/dal/menu-item-save'
import * as batchSaveDal from '@/server/dal/menu-items-batch-save'
import { revalidateMenu } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function createCategoriesAction(
  input: unknown,
): Promise<ActionResult<{ ids: string[] }>> {
  return runAction(async () => {
    const { createdIds, ...revalidationTarget } = await dal.createCategories(input)
    revalidateMenu(revalidationTarget)
    return { ids: createdIds }
  })
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.updateCategory(input))
  })
}

export async function deleteCategoryAction(
  categoryId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.deleteCategory(categoryId))
  })
}

export async function reorderCategoriesAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.reorderCategories(input))
  })
}

export async function updateItemAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.updateItem(input))
  })
}

export async function deleteItemAction(itemId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.deleteItem(itemId))
  })
}

export async function reorderItemsAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.reorderItems(input))
  })
}

export async function setItemAvailabilityAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateMenu(await dal.setItemAvailability(input))
  })
}

// Criar e editar item: uma gravação só, com item, variações e mídia.
export async function saveItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { itemId, ...revalidationTarget } = await saveDal.saveItem(input)
    revalidateMenu(revalidationTarget)
    return { id: itemId }
  })
}

export async function saveMenuItemsBatchAction(
  input: unknown,
): Promise<ActionResult<{ itemIds: string[]; categoryIds: string[] }>> {
  return runAction(async () => {
    const { itemIds, categoryIds, ...revalidationTarget } = await batchSaveDal.saveMenuItemsBatch(input)
    revalidateMenu(revalidationTarget)
    return { itemIds, categoryIds }
  })
}
