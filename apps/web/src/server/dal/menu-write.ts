import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  createCategoriesSchema,
  reorderSchema,
  setItemAvailabilitySchema,
  updateCategorySchema,
  updateItemSchema,
} from '@/domain/menu'
import type { RevalidationTarget } from '@/server/revalidate'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import { currentTerritory, requireRestaurantAdmin } from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}
type ChildTable = 'menu_categories' | 'menu_items' | 'menu_item_variants'

// Descobre o restaurante dono de um recurso filho ANTES de autorizar. Sem
// isto a autorizacao dependeria de um restaurantId enviado pelo cliente,
// que e exatamente por onde entra o IDOR: basta trocar o id no corpo da
// requisicao.
async function ownerRestaurantOf(
  table: ChildTable,
  id: string,
): Promise<string> {
  const supabase = await db()
  const { data, error } = await supabase
    .from(table)
    .select('restaurant_id')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('Recurso não encontrado')
  return data.restaurant_id as string
}

// Um insert com N linhas é UMA instrução no PostgREST: entram todas ou
// nenhuma. A posição continua a partir da última categoria, na ordem
// digitada — antes, toda categoria nova nascia em 0 e a ordem empatava.
export async function createCategories(
  input: unknown,
): Promise<RevalidationTarget & { createdIds: string[] }> {
  const data = createCategoriesSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const { data: last, error: lastError } = await supabase
    .from('menu_categories')
    .select('position')
    .eq('restaurant_id', data.restaurantId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) {
    throw new Error(`Não foi possível ler a ordem das categorias: ${lastError.message}`)
  }
  const start = last ? (last.position as number) + 1 : 0

  const { data: rows, error } = await supabase
    .from('menu_categories')
    .insert(
      data.categories.map((category, index) => ({
        restaurant_id: data.restaurantId,
        name: category.name,
        description: category.description ?? null,
        position: start + index,
      })),
    )
    .select('id')

  if (error) {
    throw new Error(`Não foi possível criar as categorias: ${error.message}`)
  }
  return {
    ...(await getRestaurantRevalidationTarget(data.restaurantId)),
    createdIds: (rows ?? []).map((row) => row.id as string),
  }
}

export async function updateCategory(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = updateCategorySchema.parse(input)
  const restaurantId = await ownerRestaurantOf('menu_categories', data.categoryId)
  await requireRestaurantAdmin(restaurantId)

  const supabase = await db()
  const { error } = await supabase
    .from('menu_categories')
    .update({
      name: data.name,
      description: data.description ?? null,
      is_visible: data.isVisible,
    })
    .eq('id', data.categoryId)

  if (error) {
    throw new Error(`Não foi possível salvar a categoria: ${error.message}`)
  }
  return getRestaurantRevalidationTarget(restaurantId)
}

export async function deleteCategory(
  categoryId: unknown,
): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(categoryId)
  const restaurantId = await ownerRestaurantOf('menu_categories', id)
  await requireRestaurantAdmin(restaurantId)

  // O alvo é lido ANTES do delete. Depois, a linha da categoria não existe
  // mais — mas o restaurante sim, então buscar o alvo aqui também
  // funcionaria. Fica antes por hábito: para item e variação a ordem também
  // não importa, mas para qualquer escrita futura que apague o restaurante
  // importaria, e uma forma só é mais fácil de manter certa.
  const revalidationTarget = await getRestaurantRevalidationTarget(restaurantId)

  const supabase = await db()
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) {
    throw new Error(`Não foi possível remover a categoria: ${error.message}`)
  }
  return revalidationTarget
}

export async function reorderCategories(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = reorderSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const { error } = await supabase.rpc('reorder_menu_categories', {
    p_restaurant_id: data.restaurantId,
    p_order: data.order,
  })
  if (error) throw new Error('Não foi possível reordenar categorias: ' + error.message)
  return getRestaurantRevalidationTarget(data.restaurantId)
}

export async function updateItem(input: unknown): Promise<RevalidationTarget> {
  const data = updateItemSchema.parse(input)
  const restaurantId = await ownerRestaurantOf('menu_items', data.itemId)
  await requireRestaurantAdmin(restaurantId)

  const supabase = await db()
  // Com variações, `base_price_cents` é derivado (o menor preço entre elas)
  // e só `save_menu_item` o grava. As ações rápidas mandam o registro
  // inteiro de volta; ignorar o preço aqui é o que impede uma delas de
  // sobrescrever o derivado.
  const { count: variantCount, error: countError } = await supabase
    .from('menu_item_variants')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', data.itemId)
  if (countError) throw new Error(`Não foi possível conferir as variações: ${countError.message}`)

  const { error } = await supabase
    .from('menu_items')
    .update({
      // Mover para a categoria de OUTRO restaurante continua impossível:
      // quem recusa é a chave estrangeira composta, não um if aqui.
      category_id: data.categoryId,
      name: data.name,
      description: data.description ?? null,
      ...(variantCount && variantCount > 0 ? {} : { base_price_cents: data.basePriceCents }),
      dietary_tags: data.dietaryTags,
      is_visible: data.isVisible,
      is_available: data.isAvailable,
    })
    .eq('id', data.itemId)

  if (error) throw new Error(`Não foi possível salvar o item: ${error.message}`)
  return getRestaurantRevalidationTarget(restaurantId)
}

export async function deleteItem(itemId: unknown): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(itemId)
  const restaurantId = await ownerRestaurantOf('menu_items', id)
  await requireRestaurantAdmin(restaurantId)
  const revalidationTarget = await getRestaurantRevalidationTarget(restaurantId)

  const supabase = await db()
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) throw new Error(`Não foi possível remover o item: ${error.message}`)
  return revalidationTarget
}

export async function reorderItems(input: unknown): Promise<RevalidationTarget> {
  const data = reorderSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const { error } = await supabase.rpc('reorder_menu_items', {
    p_restaurant_id: data.restaurantId,
    p_order: data.order,
  })
  if (error) throw new Error('Não foi possível reordenar itens: ' + error.message)
  return getRestaurantRevalidationTarget(data.restaurantId)
}

export async function setItemAvailability(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = setItemAvailabilitySchema.parse(input)
  const restaurantId = await ownerRestaurantOf('menu_items', data.itemId)
  await requireRestaurantAdmin(restaurantId)

  const supabase = await db()
  const { error } = await supabase
    .from('menu_items')
    .update({ is_available: data.isAvailable })
    .eq('id', data.itemId)

  if (error) {
    throw new Error(`Não foi possível alterar a disponibilidade: ${error.message}`)
  }
  return getRestaurantRevalidationTarget(restaurantId)
}

