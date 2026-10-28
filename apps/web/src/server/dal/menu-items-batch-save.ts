import 'server-only'
import type { Json } from '@/domain/database.types'
import { saveMenuItemsBatchSchema, type SaveMenuItemsBatchInput } from '@/domain/menu'
import type { RevalidationTarget } from '@/server/revalidate'
import { createUserClient } from './_client'
import { ConflictError, currentTerritory, requireRestaurantAdmin, UserFacingError } from './auth'
import { discardItemBatchUploads } from './media'
import { getRestaurantRevalidationTarget } from './revalidation-target'

type BatchMedia = {
  source: 'new'
  kind: 'image' | 'video'
  storagePath: string
  posterPath?: string
}

function uploadFiles(data: SaveMenuItemsBatchInput) {
  return data.items.flatMap((item) => item.media.flatMap((media) => {
    if (media.source !== 'new') return []
    const entry = media as BatchMedia
    const prefix = `${data.restaurantId}/${item.itemId}/`
    const allowedPath = (path: string) => {
      const basename = path.startsWith(prefix) ? path.slice(prefix.length) : ''
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(basename)
    }
    return [
      ...(allowedPath(entry.storagePath) ? [{ itemId: item.itemId, kind: entry.kind, path: entry.storagePath }] : []),
      ...(entry.posterPath && allowedPath(entry.posterPath) ? [{ itemId: item.itemId, kind: 'image' as const, path: entry.posterPath }] : []),
    ]
  }))
}

export async function saveMenuItemsBatch(input: unknown): Promise<RevalidationTarget & { itemIds: string[]; categoryIds: string[] }> {
  const data = saveMenuItemsBatchSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await createUserClient(await currentTerritory())
  const { data: result, error } = await supabase.rpc('save_menu_items_batch', {
    p_payload: data as unknown as Json,
  })

  if (error) {
    const files = uploadFiles(data)
    if (files.length > 0) await discardItemBatchUploads({ restaurantId: data.restaurantId, files })
    if (error.code === 'P0001') throw new ConflictError(error.message)
    if (error.code === '23505') {
      throw new ConflictError('O cardápio mudou durante a criação. Atualize a página e tente novamente.')
    }
    console.error('[save_menu_items_batch]', error.code, error.message)
    throw new UserFacingError(`Não foi possível criar o lote (erro ${error.code}).`)
  }

  const payload = result as { itemIds?: unknown; categoryIds?: unknown } | null
  const itemIds = Array.isArray(payload?.itemIds) ? payload.itemIds.filter((id): id is string => typeof id === 'string') : []
  const categoryIds = Array.isArray(payload?.categoryIds) ? payload.categoryIds.filter((id): id is string => typeof id === 'string') : []
  return { ...(await getRestaurantRevalidationTarget(data.restaurantId)), itemIds, categoryIds }
}
