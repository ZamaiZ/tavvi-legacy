'use server'

import type { BrandSlot } from '@/domain/media'
import * as dal from '@/server/dal/media'
import { revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

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

// Autoriza o envio de um arquivo do item (existente ou por criar). Não
// grava no banco, então não revalida nada.
export async function createItemUploadTicketAction(
  input: unknown,
): Promise<ActionResult<{ itemId: string; path: string; signedUrl: string }>> {
  return runAction(() => dal.createItemUploadTicket(input))
}

// Sobras de um salvamento que não chegou ao banco.
export async function discardItemUploadsAction(input: unknown): Promise<ActionResult> {
  return runAction(() => dal.discardItemUploads(input))
}
