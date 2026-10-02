import 'server-only'
import type { Json } from '@/domain/database.types'
import type { MediaKind } from '@/domain/media'
import { saveItemSchema } from '@/domain/menu'
import type { RevalidationTarget } from '@/server/revalidate'
import { createUserClient } from './_client'
import { ConflictError, currentTerritory, requireRestaurantAdmin, UserFacingError } from './auth'
import { removeStorageFiles } from './media'
import { getRestaurantRevalidationTarget } from './revalidation-target'

type StoredFile = { kind: MediaKind; path: string }
type RemovedMedia = { kind: MediaKind; storagePath: string; posterPath: string | null }

function filesOf(media: { kind: MediaKind; storagePath: string; posterPath?: string | null }[]): StoredFile[] {
  return media.flatMap((entry) => [
    { kind: entry.kind, path: entry.storagePath },
    // A capa do vídeo mora no bucket de imagem.
    ...(entry.posterPath ? [{ kind: 'image' as const, path: entry.posterPath }] : []),
  ])
}

// Grava o item inteiro numa transação (`save_menu_item`). Se o banco
// recusar, os arquivos que acabaram de subir são apagados: nada fica pela
// metade. Se aceitar, os arquivos das mídias removidas saem do storage.
export async function saveItem(input: unknown): Promise<RevalidationTarget & { itemId: string }> {
  const data = saveItemSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await createUserClient(await currentTerritory())
  const { data: result, error } = await supabase.rpc('save_menu_item', {
    p_payload: data as unknown as Json,
  })

  if (error) {
    // flatMap, e não filter: o ramo do ternário estreita o tipo para a mídia nova.
    await removeStorageFiles(filesOf(data.media.flatMap((entry) => (entry.source === 'new' ? [entry] : []))))
    // P0001 é a função falando: a mensagem é a causa exata, em português.
    if (error.code === 'P0001') throw new ConflictError(error.message)
    // Chave primária repetida: o item desta tela já foi criado (envio duplo).
    if (error.code === '23505') {
      throw new ConflictError('Este item já foi criado. Feche e abra o cardápio de novo.')
    }
    console.error('[save_menu_item]', error.code, error.message)
    throw new UserFacingError(`Não foi possível salvar o item (erro ${error.code}).`)
  }

  const removed = ((result as { removed?: RemovedMedia[] } | null)?.removed ?? [])
  await removeStorageFiles(filesOf(removed))

  return { ...(await getRestaurantRevalidationTarget(data.restaurantId)), itemId: data.itemId }
}
