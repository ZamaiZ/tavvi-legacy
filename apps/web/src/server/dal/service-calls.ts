import 'server-only'
import { listServiceCallsSchema, serviceCallFromRow, serviceCallRefSchema, serviceCallRestaurantSchema, type ServiceCallDTO, type ServiceCallPage } from '@/domain/service-call'
import { createUserClient } from './_client'
import { currentTerritory, requireMember, UserFacingError } from './auth'

const PAGE_SIZE = 100

async function db() {
  return createUserClient(await currentTerritory())
}

export async function listServiceCalls(input: unknown): Promise<ServiceCallPage> {
  const { restaurantId, status, cursor } = listServiceCallsSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  let query = supabase
    .from('service_calls')
    .select('id, restaurant_id, tag_id, table_number, status, created_at, resolved_at, resolved_by')
    .eq('restaurant_id', restaurantId)
    .eq('status', status)
    .order('created_at', { ascending: status === 'pending' })
    .order('id', { ascending: status === 'pending' })
    .limit(PAGE_SIZE + 1)
  if (cursor) {
    const operator = status === 'pending' ? 'gt' : 'lt'
    query = query.or(`created_at.${operator}."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.${operator}.${cursor.id})`)
  }
  const { data, error } = await query
  if (error) throw new Error(`Não foi possível carregar os chamados: ${error.message}`)
  const rows = data ?? []
  const items = rows.slice(0, PAGE_SIZE).map(serviceCallFromRow).filter((row): row is ServiceCallDTO => row !== null)
  const last = items.at(-1)
  return {
    items,
    hasMore: rows.length > PAGE_SIZE,
    nextCursor: rows.length > PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

export async function countPendingServiceCalls(input: unknown): Promise<number> {
  const { restaurantId } = serviceCallRestaurantSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { count, error } = await supabase
    .from('service_calls')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
  if (error) throw new Error(`Não foi possível contar os chamados pendentes: ${error.message}`)
  return count ?? 0
}

export async function countPendingServiceCallsForShell(restaurantId: string): Promise<number> {
  try {
    return await countPendingServiceCalls({ restaurantId })
  } catch (error) {
    console.error('[chamados] contagem da casca', error instanceof Error ? error.message : error)
    return 0
  }
}

export async function getServiceCall(input: unknown): Promise<ServiceCallDTO | null> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, restaurant_id, tag_id, table_number, status, created_at, resolved_at, resolved_by')
    .eq('restaurant_id', restaurantId)
    .eq('id', callId)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível localizar o chamado: ${error.message}`)
  return data ? serviceCallFromRow(data) : null
}

export async function resolveServiceCall(input: unknown): Promise<ServiceCallDTO> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase.rpc('resolve_service_call', { p_call_id: callId })
  if (error) {
    if (error.message === 'service_call_not_found') throw new UserFacingError('Este chamado não existe mais.')
    if (error.message === 'forbidden') throw new UserFacingError('Você não tem acesso a este chamado.')
    throw new Error(`Não foi possível concluir o chamado: ${error.message}`)
  }
  const row = data?.[0]
  const call = row ? serviceCallFromRow({
    id: row.call_id,
    restaurant_id: row.restaurant_id,
    tag_id: row.tag_id,
    table_number: row.table_number,
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
  }) : null
  if (!call || call.restaurantId !== restaurantId) throw new UserFacingError('Este chamado não existe mais.')
  return call
}
