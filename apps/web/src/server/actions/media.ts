'use server'

import type { BrandSlot, MediaKind } from '@/domain/media'
import * as dal from '@/server/dal/media'
import { revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

// Os tickets de envio não revalidam nada: eles não escrevem no banco, só
// pedem uma URL assinada ao storage. Quem grava é o `register`, logo abaixo.
export async function createUploadTicketAction(input: {
  itemId: string
  kind: MediaKind
  mimeType: string
}): Promise<ActionResult<{ bucket: string; path: string; signedUrl: string }>> {
  return runAction(() => dal.createUploadTicket(input))
}

export async function createBrandUploadTicketAction(input: {
  restaurantId: string
  slot: BrandSlot
  mimeType: string
}): Promise<ActionResult<{ bucket: string; path: string; signedUrl: string }>> {
  return runAction(() => dal.createBrandUploadTicket(input))
}

export async function setBrandImageAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.setBrandImage(input))
  })
}

export async function registerItemMediaAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const { createdId, ...revalidationTarget } = await dal.registerItemMedia(input)
    revalidateRestaurant(revalidationTarget)
    return { id: createdId }
  })
}

export async function deleteItemMediaAction(
  mediaId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.deleteItemMedia(mediaId))
  })
}

export async function setMediaFocalAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.setMediaFocal(input))
  })
}

export async function reorderItemMediaAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.reorderItemMedia(input))
  })
}
