import 'server-only'
import { randomUUID } from 'node:crypto'
import { uuidSchema } from '@/domain/common'
import {
  brandSlotSchema,
  MAX_MEDIA_PER_ITEM,
  MEDIA_LIMITS,
  registerMediaSchema,
  reorderMediaSchema,
  setBrandImageSchema,
  setMediaFocalSchema,
  type BrandSlot,
  type MediaKind,
} from '@/domain/media'
import type { RevalidationTarget } from '@/server/revalidate'
import { recordAudit } from '@/server/security/audit'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import {
  ConflictError,
  currentTerritory,
  requireRestaurantAdmin,
  UserFacingError,
} from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// O caminho e montado no SERVIDOR, a partir do restaurante resolvido no
// servidor. O navegador nunca escolhe onde grava: o prefixo do caminho e a
// fronteira do inquilino, e deixar o cliente decidi-lo anularia a politica
// de storage inteira.
export async function createUploadTicket(input: {
  itemId: string
  kind: MediaKind
  mimeType: string
}): Promise<{ bucket: string; path: string; signedUrl: string }> {
  const itemId = uuidSchema.parse(input.itemId)

  const limits = MEDIA_LIMITS[input.kind]
  if (!(limits.mimes as readonly string[]).includes(input.mimeType)) {
    throw new UserFacingError('Formato de arquivo não aceito.')
  }

  const supabase = await db()
  const { data, error } = await supabase
    .from('menu_items')
    .select('restaurant_id')
    .eq('id', itemId)
    .single()

  if (error || !data) throw new UserFacingError('Item não encontrado.')
  const restaurantId = data.restaurant_id
  await requireRestaurantAdmin(restaurantId)

  const extension = EXTENSION_BY_MIME[input.mimeType]
  // O caminho é montado no SERVIDOR, a partir do restaurante resolvido no
  // servidor. O navegador nunca escolhe onde grava: o prefixo do caminho é
  // a fronteira do inquilino, e deixar o cliente decidi-lo anularia a
  // política de storage inteira.
  const path = `${restaurantId}/${itemId}/${randomUUID()}.${extension}`

  // A assinatura também passa pela RLS do storage: se esta sessão não
  // puder escrever neste caminho, o Supabase recusa aqui.
  const { data: ticket, error: signError } = await supabase.storage
    .from(limits.bucket)
    .createSignedUploadUrl(path)

  if (signError || !ticket) {
    throw new UserFacingError('Não foi possível autorizar o envio.')
  }

  return { bucket: limits.bucket, path, signedUrl: ticket.signedUrl }
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

export async function registerItemMedia(
  input: unknown,
): Promise<RevalidationTarget & { createdId: string }> {
  const data = registerMediaSchema.parse(input)

  const supabase = await db()
  const { data: item, error: lookupError } = await supabase
    .from('menu_items')
    .select('restaurant_id')
    .eq('id', data.itemId)
    .single()

  if (lookupError || !item) throw new Error('Item não encontrado')
  const restaurantId = item.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)

  // Revalidamos o prefixo aqui mesmo com o CHECK do banco fazendo o mesmo.
  // O CHECK e a garantia; esta linha e a mensagem de erro decente.
  if (!data.storagePath.startsWith(`${restaurantId}/`)) {
    throw new Error('Caminho de arquivo inválido')
  }

  // Uma consulta, dois problemas. O teto por item e REGRA: o navegador
  // confere para responder na hora, mas quem garante e esta linha. E a
  // contagem do mesmo tipo vira a position da nova midia -- sem isso toda
  // linha fica no default 0, a ordem da galeria passa a depender do que o
  // banco devolver naquele instante, e a miniatura do item troca sozinha.
  const { data: siblings, error: countError } = await supabase
    .from('menu_item_media')
    .select('kind')
    .eq('item_id', data.itemId)

  if (countError) {
    throw new Error(
      `Não foi possível conferir a mídia do item: ${countError.message}`,
    )
  }

  const todas = siblings ?? []

  // Teto por ITEM, e não por tipo, desde a Fase 5. O dono pensa em "quantas
  // telas tem meu prato", não em "quantas imagens e quantos vídeos" — e o
  // cliente, no feed, também não distingue: ele só rola.
  if (todas.length >= MAX_MEDIA_PER_ITEM) {
    // ConflictError, nao Error cru: so UserFacingError e suas filhas
    // atravessam o runAction com a mensagem intacta. Um Error comum viraria
    // "Nao foi possivel concluir a operacao" e o dono nao saberia o que fazer.
    throw new ConflictError(
      `Este prato já tem ${MAX_MEDIA_PER_ITEM} telas. Remova uma para enviar outra.`,
    )
  }

  const { data: row, error } = await supabase
    .from('menu_item_media')
    .insert({
      restaurant_id: restaurantId,
      item_id: data.itemId,
      kind: data.kind,
      // A posição conta o item INTEIRO, e não o tipo. Contar por tipo punha
      // a primeira imagem e o vídeo os dois em 0, e no feed a ordem das
      // mídias É a ordem das telas: duas em 0 deixam indefinido qual abre o
      // prato. O TETO continua sendo por tipo, em `sameKind`, acima.
      position: todas.length,
      storage_path: data.storagePath,
      poster_path: data.posterPath ?? null,
      alt_text: data.altText ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      duration_ms: data.durationMs ?? null,
      focal_x: data.focalX ?? 0.5,
      focal_y: data.focalY ?? 0.5,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Não foi possível registrar a mídia: ${error.message}`)
  }
  return {
    ...(await getRestaurantRevalidationTarget(restaurantId)),
    createdId: row.id as string,
  }
}

export async function deleteItemMedia(
  mediaId: unknown,
): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(mediaId)

  const supabase = await db()
  const { data: row, error: lookupError } = await supabase
    .from('menu_item_media')
    .select('restaurant_id, kind, storage_path, poster_path')
    .eq('id', id)
    .single()

  if (lookupError || !row) throw new Error('Mídia não encontrada')
  const restaurantId = row.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)
  const revalidationTarget = await getRestaurantRevalidationTarget(restaurantId)

  const bucket = MEDIA_LIMITS[row.kind as MediaKind].bucket
  // Remove o arquivo ANTES da linha. Se a ordem fosse invertida e a segunda
  // etapa falhasse, sobraria arquivo sem dono e sem rastro no banco -- o
  // pior dos dois estados possiveis.
  await supabase.storage.from(bucket).remove([row.storage_path as string])

  // A capa mora no bucket de imagem, mesmo pertencendo a um video. Deixa-la
  // para tras daria um arquivo pago e inalcancavel a cada video trocado --
  // e invisivel, porque nada no banco voltaria a apontar para ele.
  if (row.poster_path) {
    await supabase.storage
      .from(MEDIA_LIMITS.image.bucket)
      .remove([row.poster_path as string])
  }

  const { error } = await supabase.from('menu_item_media').delete().eq('id', id)
  if (error) {
    throw new Error(`Não foi possível remover a mídia: ${error.message}`)
  }
  return revalidationTarget
}

export async function setMediaFocal(input: unknown): Promise<RevalidationTarget> {
  const data = setMediaFocalSchema.parse(input)

  const supabase = await db()
  const { data: row, error: lookupError } = await supabase
    .from('menu_item_media')
    .select('restaurant_id')
    .eq('id', data.mediaId)
    .single()

  if (lookupError || !row) throw new Error('Mídia não encontrada')
  const restaurantId = row.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)

  const { error } = await supabase
    .from('menu_item_media')
    .update({ focal_x: data.focalX, focal_y: data.focalY })
    .eq('id', data.mediaId)

  if (error) {
    throw new Error(`Não foi possível salvar o enquadramento: ${error.message}`)
  }

  return getRestaurantRevalidationTarget(restaurantId)
}

export async function reorderItemMedia(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = reorderMediaSchema.parse(input)

  const supabase = await db()
  const { data: item, error: lookupError } = await supabase
    .from('menu_items')
    .select('restaurant_id')
    .eq('id', data.itemId)
    .single()

  if (lookupError || !item) throw new Error('Item não encontrado')
  const restaurantId = item.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)

  // Uma chamada por linha, e não um upsert em lote: o upsert do PostgREST
  // exige mandar a linha inteira, e mandar colunas que não mudaram abre a
  // porta para sobrescrever `storage_path` por engano. O teto por item é de
  // cinco mídias, então cinco chamadas é o pior caso.
  for (const entry of data.order) {
    const { error } = await supabase
      .from('menu_item_media')
      .update({ position: entry.position })
      .eq('id', entry.id)
      // A trava: sem ela, um id de mídia de OUTRO item passaria pela
      // autorização que acabou de ser feita sobre este item.
      .eq('item_id', data.itemId)

    if (error) throw new Error(`Não foi possível reordenar: ${error.message}`)
  }

  return getRestaurantRevalidationTarget(restaurantId)
}
