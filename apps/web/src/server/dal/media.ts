import 'server-only'
import { randomUUID } from 'node:crypto'
import { uuidSchema } from '@/domain/common'
import {
  brandSlotSchema,
  discardUploadsSchema,
  itemUploadTicketSchema,
  itemBatchUploadTicketsSchema,
  discardItemBatchUploadsSchema,
  MEDIA_LIMITS,
  setBrandImageSchema,
  type BrandSlot,
  type MediaKind,
  type BatchUploadTicket,
} from '@/domain/media'
import type { RevalidationTarget } from '@/server/revalidate'
import { recordAudit } from '@/server/security/audit'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import {
  currentTerritory,
  requireRestaurantAdmin,
  UserFacingError,
} from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await mapper(items[index])
    }
  }))
  return results
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// Irmão do createUploadTicket, para a marca do restaurante. Precisa existir
// separado porque aquele resolve o restaurante a partir de um ITEM, e logo e
// capa não pertencem a item nenhum.
//
// O caminho continua sendo montado no SERVIDOR, a partir do restaurante
// resolvido no servidor. O navegador nunca escolhe onde grava: o prefixo é a
// fronteira do inquilino, e deixar o cliente decidi-lo anularia a política de
// storage inteira.
export async function createBrandUploadTicket(input: {
  restaurantId: string
  slot: BrandSlot
  mimeType: string
}): Promise<{ bucket: string; path: string; signedUrl: string }> {
  const restaurantId = uuidSchema.parse(input.restaurantId)
  const slot = brandSlotSchema.parse(input.slot)
  await requireRestaurantAdmin(restaurantId)

  const limits = MEDIA_LIMITS.image
  if (!(limits.mimes as readonly string[]).includes(input.mimeType)) {
    throw new UserFacingError('Formato de arquivo não aceito.')
  }

  const extension = EXTENSION_BY_MIME[input.mimeType]
  // `brand` como segundo segmento, e não como primeiro: o primeiro é lido
  // pela `restaurant_id_from_storage_path` para descobrir o inquilino, e
  // mudá-lo deixaria a política de storage sem saber de quem é o arquivo.
  const path = `${restaurantId}/brand/${slot}-${randomUUID()}.${extension}`

  const supabase = await db()
  // A assinatura também passa pela RLS do storage: se esta sessão não puder
  // escrever neste caminho, o Supabase recusa aqui.
  const { data: ticket, error } = await supabase.storage
    .from(limits.bucket)
    .createSignedUploadUrl(path)

  if (error || !ticket) {
    throw new UserFacingError('Não foi possível autorizar o envio.')
  }

  return { bucket: limits.bucket, path, signedUrl: ticket.signedUrl }
}

// Grava o caminho novo e APAGA o antigo. Trocar a logo cinco vezes sem esta
// limpeza deixaria quatro arquivos pagos e inalcançáveis — invisíveis,
// porque nada no banco voltaria a apontar para eles. É o mesmo defeito que a
// revisão da Fase 2 encontrou na capa de vídeo.
export async function setBrandImage(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = setBrandImageSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const { data: currentRestaurant, error: lookupError } = await supabase
    .from('restaurants')
    .select('logo_path, cover_path')
    .eq('id', data.restaurantId)
    .single()

  if (lookupError || !currentRestaurant) {
    throw new UserFacingError('Restaurante não encontrado.')
  }

  const anterior =
    data.slot === 'logo'
      ? (currentRestaurant.logo_path as string | null)
      : (currentRestaurant.cover_path as string | null)

  // Objeto explícito por ramo, e não chave computada: `{ [coluna]: valor }`
  // vira uma assinatura de índice genérica, que o tipo gerado do banco recusa
  // — e com razão, porque ela aceitaria qualquer nome de coluna.
  const { error } = await supabase
    .from('restaurants')
    .update(
      data.slot === 'logo'
        ? { logo_path: data.storagePath }
        : { cover_path: data.storagePath },
    )
    .eq('id', data.restaurantId)

  if (error) throw new Error(`Não foi possível salvar: ${error.message}`)

  // A remoção vem DEPOIS da gravação, ao contrário do deleteItemMedia. A
  // ordem é oposta de propósito: lá a linha some junto, e arquivo órfão é o
  // pior estado; aqui a linha continua existindo, e apagar antes deixaria o
  // cardápio apontando para um arquivo que já não existe caso o update
  // falhasse.
  if (anterior && anterior !== data.storagePath) {
    await supabase.storage.from(MEDIA_LIMITS.image.bucket).remove([anterior])
  }

  await recordAudit({
    action: 'restaurant.brand_updated',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
    metadata: { slot: data.slot, removed: data.storagePath === null },
  })

  return getRestaurantRevalidationTarget(data.restaurantId)
}

// Autoriza o envio de um arquivo de item, existente ou ainda por criar.
// Para item novo, o id nasce AQUI e volta ao navegador: os arquivos sobem
// antes de o item existir, para a gravação no banco ser uma só.
export async function createItemUploadTicket(
  input: unknown,
): Promise<{ itemId: string; path: string; signedUrl: string }> {
  const data = itemUploadTicketSchema.parse(input)
  const limits = MEDIA_LIMITS[data.kind]
  if (!(limits.mimes as readonly string[]).includes(data.mimeType)) {
    throw new UserFacingError('Formato de arquivo não aceito.')
  }
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  let itemId = data.itemId
  if (itemId) {
    const { data: item, error } = await supabase
      .from('menu_items')
      .select('restaurant_id')
      .eq('id', itemId)
      .maybeSingle()
    if (error) throw new Error(`Não foi possível conferir o item: ${error.message}`)
    // Item de outro restaurante não autoriza nada aqui.
    if (item && item.restaurant_id !== data.restaurantId) {
      throw new UserFacingError('Item não encontrado.')
    }
  } else {
    itemId = randomUUID()
  }

  // O caminho continua sendo montado no SERVIDOR: o prefixo é a fronteira
  // do inquilino, e a função no banco confere `restaurante/item/` de novo.
  const path = `${data.restaurantId}/${itemId}/${randomUUID()}.${EXTENSION_BY_MIME[data.mimeType]}`
  const { data: ticket, error: signError } = await supabase.storage
    .from(limits.bucket)
    .createSignedUploadUrl(path)

  if (signError || !ticket) {
    throw new UserFacingError('Não foi possível autorizar o envio.')
  }
  return { itemId, path, signedUrl: ticket.signedUrl }
}

// Autoriza todos os arquivos do lote numa única chamada. O cliente informa
// tipos e IDs locais, nunca caminhos; cada caminho é montado aqui.
export async function createItemBatchUploadTickets(input: unknown): Promise<{ tickets: BatchUploadTicket[] }> {
  const data = itemBatchUploadTicketsSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const itemIds = [...new Set(data.files.map((file) => file.itemId))]
  const { data: existingItems, error: lookupError } = await supabase
    .from('menu_items')
    .select('id')
    .in('id', itemIds)
  if (lookupError) throw new Error(`Não foi possível conferir os itens do lote: ${lookupError.message}`)
  if ((existingItems ?? []).length > 0) throw new UserFacingError('Um item deste rascunho já existe. Atualize o cardápio e tente novamente.')

  const tickets = await mapWithConcurrency(data.files, 8, async (file): Promise<BatchUploadTicket> => {
    const limits = MEDIA_LIMITS[file.kind]
    if (!(limits.mimes as readonly string[]).includes(file.mimeType)) {
      throw new UserFacingError('Formato de arquivo não aceito.')
    }
    if (file.posterMimeType && file.kind !== 'video') {
      throw new UserFacingError('Somente vídeos podem ter uma capa.')
    }
    const path = `${data.restaurantId}/${file.itemId}/${randomUUID()}.${EXTENSION_BY_MIME[file.mimeType]}`
    const { data: ticket, error } = await supabase.storage.from(limits.bucket).createSignedUploadUrl(path)
    if (error || !ticket) throw new UserFacingError('Não foi possível autorizar o envio das mídias.')

    let poster: BatchUploadTicket['poster']
    if (file.posterMimeType) {
      const imageLimits = MEDIA_LIMITS.image
      if (!(imageLimits.mimes as readonly string[]).includes(file.posterMimeType)) {
        throw new UserFacingError('Formato de capa de vídeo não aceito.')
      }
      const posterPath = `${data.restaurantId}/${file.itemId}/${randomUUID()}.${EXTENSION_BY_MIME[file.posterMimeType]}`
      const { data: posterTicket, error: posterError } = await supabase.storage
        .from(imageLimits.bucket)
        .createSignedUploadUrl(posterPath)
      // A capa é opcional no fluxo individual: se a assinatura falhar, o
      // feed ainda pode usar o primeiro quadro do vídeo.
      if (posterError || !posterTicket) {
        console.error('[media] autorização da capa de vídeo', posterError?.message)
      } else {
        poster = { bucket: imageLimits.bucket, path: posterPath, signedUrl: posterTicket.signedUrl }
      }
    }

    return { itemId: file.itemId, mediaKey: file.mediaKey, kind: file.kind, bucket: limits.bucket, path, signedUrl: ticket.signedUrl, ...(poster ? { poster } : {}) }
  })
  return { tickets }
}

// Remove arquivos do storage, cada um no bucket do seu tipo. Melhor
// esforço: uma falha aqui deixa um arquivo órfão (registrado no log), mas
// nunca desfaz uma gravação que já deu certo.
export async function removeStorageFiles(files: { kind: MediaKind; path: string }[]): Promise<void> {
  if (files.length === 0) return
  const supabase = await db()
  for (const kind of ['image', 'video'] as const) {
    const paths = files.filter((file) => file.kind === kind).map((file) => file.path)
    if (paths.length === 0) continue
    const { error } = await supabase.storage.from(MEDIA_LIMITS[kind].bucket).remove(paths)
    if (error) console.error('[media] remoção de arquivos', kind, error.message)
  }
}

// Sobras de um salvamento que falhou: apaga só arquivos DESTE item, direto
// na pasta dele, e que nenhuma linha usa — um arquivo referenciado é mídia
// de verdade, não sobra.
export async function discardItemUploads(input: unknown): Promise<void> {
  const data = discardUploadsSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const prefix = `${data.restaurantId}/${data.itemId}/`
  const candidates = data.files.filter(
    (file) => file.path.startsWith(prefix) && !file.path.slice(prefix.length).includes('/'),
  )
  if (candidates.length === 0) return

  const supabase = await db()
  const paths = candidates.map((file) => file.path)
  const [byStorage, byPoster] = await Promise.all([
    supabase.from('menu_item_media').select('storage_path').in('storage_path', paths),
    supabase.from('menu_item_media').select('poster_path').in('poster_path', paths),
  ])
  if (byStorage.error || byPoster.error) {
    console.error('[media] conferência de sobras', byStorage.error ?? byPoster.error)
    return
  }
  const used = new Set<string>([
    ...(byStorage.data ?? []).map((row) => row.storage_path as string),
    ...(byPoster.data ?? []).map((row) => row.poster_path as string),
  ])
  await removeStorageFiles(candidates.filter((file) => !used.has(file.path)))
}

// Limpa somente objetos com nome gerado pelo servidor, no prefixo do item,
// e ainda não referenciados como mídia ou capa.
export async function discardItemBatchUploads(input: unknown): Promise<void> {
  const data = discardItemBatchUploadsSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const candidates = data.files.filter(({ itemId, path }) => {
    const prefix = `${data.restaurantId}/${itemId}/`
    const basename = path.startsWith(prefix) ? path.slice(prefix.length) : ''
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(basename)
  })
  if (candidates.length === 0) return

  const supabase = await db()
  const paths = [...new Set(candidates.map((file) => file.path))]
  const [byStorage, byPoster] = await Promise.all([
    supabase.from('menu_item_media').select('storage_path').in('storage_path', paths),
    supabase.from('menu_item_media').select('poster_path').in('poster_path', paths),
  ])
  if (byStorage.error || byPoster.error) {
    console.error('[media] conferência de sobras do lote', byStorage.error ?? byPoster.error)
    return
  }
  const used = new Set<string>([
    ...(byStorage.data ?? []).map((row) => row.storage_path as string),
    ...(byPoster.data ?? []).map((row) => row.poster_path as string),
  ])
  await removeStorageFiles(candidates.filter((file) => !used.has(file.path)))
}
