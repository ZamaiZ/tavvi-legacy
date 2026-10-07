'use server'

import type { NfcEventDTO, TagDTO } from '@/domain/tag'
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

export async function recordNfcEventAction(input: unknown): Promise<ActionResult<{ verifiedAt: string | null }>> {
  return runAction(async () => {
    const result = await dal.recordNfcEvent(input)
    if (result.revalidationTarget) revalidateRestaurant(result.revalidationTarget)
    return { verifiedAt: result.verifiedAt }
  })
}

export async function listNfcEventsAction(tagId: unknown): Promise<ActionResult<NfcEventDTO[]>> {
  return runAction(() => dal.listNfcEvents(tagId))
}
