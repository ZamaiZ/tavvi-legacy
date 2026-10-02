'use server'

import type { TagDTO } from '@/domain/tag'
import * as dal from '@/server/dal/tags'
import { revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function createTagAction(
  input: unknown,
): Promise<ActionResult<TagDTO>> {
  return runAction(async () => {
    const { tag, ...revalidationTarget } = await dal.createTag(input)
    revalidateRestaurant(revalidationTarget)
    return tag
  })
}

export async function listTagsAction(restaurantId: unknown): Promise<ActionResult<TagDTO[]>> {
  return runAction(() => dal.listTags(restaurantId))
}

export async function updateTagAction(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.updateTag(input))
  })
}

export async function deleteTagAction(tagId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.deleteTag(tagId))
  })
}
