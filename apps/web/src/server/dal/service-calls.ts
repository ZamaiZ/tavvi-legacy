import 'server-only'
import {
  listServiceCallsSchema,
  serviceCallEventFromRow,
  serviceCallFromRow,
  serviceCallRefSchema,
  serviceCallRestaurantSchema,
  serviceCallsDashboardSchema,
  transferServiceCallSchema,
  type ClaimServiceCallOutcome,
  type ResolveServiceCallOutcome,
  type ServiceCallDTO,
  type ServiceCallEventDTO,
  type ServiceCallMutationResult,
  type ServiceCallPage,
  type ServiceCallStatus,
  type ServiceCallTeamMemberDTO,
  type ServiceCallsDashboard,
  type TransferServiceCallOutcome,
} from '@/domain/service-call'
import { memberRoleSchema } from '@/domain/invite'
import { createUserClient } from './_client'
import { currentTerritory, requireMember, requireUser, UserFacingError } from './auth'

const PAGE_SIZE = 100

function settledDashboardField<T>(
  field: keyof ServiceCallsDashboard['errors'],
  result: PromiseSettledResult<T>,
  errors: ServiceCallsDashboard['errors'],
): T | undefined {
  if (result.status === 'fulfilled') return result.value
  console.error(`[service-calls] dashboard ${field} query failed`, result.reason)
  errors[field] = 'Não foi possível atualizar esta seção.'
  return undefined
}

async function db() {
  return createUserClient(await currentTerritory())
}

export async function listServiceCalls(input: unknown): Promise<ServiceCallPage> {
  const { restaurantId, status, cursor } = listServiceCallsSchema.parse(input)
  await requireMember(restaurantId)
  return queryServiceCalls(await db(), restaurantId, status, cursor)
}

type ServiceCallClient = Awaited<ReturnType<typeof db>>

async function queryServiceCalls(
  supabase: ServiceCallClient,
  restaurantId: string,
  status: ServiceCallStatus,
  cursor?: { createdAt: string; id: string },
): Promise<ServiceCallPage> {
  let query = supabase
    .from('service_calls')
    .select('id, restaurant_id, tag_id, table_number, status, created_at, first_claimed_at, first_claimed_by, assigned_to, resolved_at, resolved_by')
    .eq('restaurant_id', restaurantId)
    .eq('status', status)
    .order('created_at', { ascending: status !== 'resolved' })
    .order('id', { ascending: status !== 'resolved' })
    .limit(PAGE_SIZE + 1)
  if (cursor) {
    const operator = status === 'resolved' ? 'lt' : 'gt'
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

async function dashboardTeam(
  supabase: ServiceCallClient,
  restaurantId: string,
): Promise<ServiceCallTeamMemberDTO[]> {
  const { data, error } = await supabase.rpc('list_restaurant_members', { p_restaurant_id: restaurantId })
  if (error) throw new Error(`Não foi possível carregar a equipe: ${error.message}`)
  return (data ?? []).flatMap((row) => {
    const role = memberRoleSchema.safeParse(row.member_role)
    if (!role.success) return []
    return [{
      userId: row.user_id,
      displayName: row.display_name?.trim() || 'Membro da equipe',
      role: role.data,
    }]
  })
}

async function dashboardSelectedCall(
  supabase: ServiceCallClient,
  restaurantId: string,
  callId: string,
): Promise<ServiceCallDTO | null> {
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, restaurant_id, tag_id, table_number, status, created_at, first_claimed_at, first_claimed_by, assigned_to, resolved_at, resolved_by')
    .eq('restaurant_id', restaurantId)
    .eq('id', callId)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível localizar o chamado: ${error.message}`)
  return data ? serviceCallFromRow(data) : null
}

async function dashboardEvents(
  supabase: ServiceCallClient,
  restaurantId: string,
  callId: string,
): Promise<ServiceCallEventDTO[]> {
  const { data, error } = await supabase
    .from('service_call_events')
    .select('id, call_id, restaurant_id, event_type, actor_id, previous_assignee_id, next_assignee_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('call_id', callId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`NÃ£o foi possÃ­vel carregar o histÃ³rico do chamado: ${error.message}`)
  return (data ?? []).map(serviceCallEventFromRow).filter((event): event is ServiceCallEventDTO => event !== null)
}

export async function getServiceCallsDashboard(input: unknown): Promise<ServiceCallsDashboard> {
  const { restaurantId, selectedCallId, includeEvents } = serviceCallsDashboardSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const results = await Promise.allSettled([
    queryServiceCalls(supabase, restaurantId, 'pending'),
    queryServiceCalls(supabase, restaurantId, 'in_progress'),
    queryServiceCalls(supabase, restaurantId, 'resolved'),
    dashboardTeam(supabase, restaurantId),
    (async () => {
      const { count, error } = await supabase.from('service_calls').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'pending')
      if (error) throw new Error(`Não foi possível contar os chamados pendentes: ${error.message}`)
      return count ?? 0
    })(),
    (async () => {
      const { count, error } = await supabase.from('service_calls').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'in_progress')
      if (error) throw new Error(`Não foi possível contar os chamados em atendimento: ${error.message}`)
      return count ?? 0
    })(),
    (async () => {
      const { count, error } = await supabase.from('service_calls').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'resolved')
      if (error) throw new Error(`Não foi possível contar os chamados concluídos: ${error.message}`)
      return count ?? 0
    })(),
    selectedCallId ? dashboardSelectedCall(supabase, restaurantId, selectedCallId) : Promise.resolve(null),
    includeEvents && selectedCallId
      ? dashboardEvents(supabase, restaurantId, selectedCallId)
      : Promise.resolve(undefined),
  ])
  const errors: ServiceCallsDashboard['errors'] = {}
  const pending = settledDashboardField('pending', results[0], errors)
  const inProgress = settledDashboardField('inProgress', results[1], errors)
  const resolved = settledDashboardField('resolved', results[2], errors)
  const team = settledDashboardField('team', results[3], errors)
  const pendingCount = settledDashboardField('pendingCount', results[4], errors)
  const inProgressCount = settledDashboardField('inProgressCount', results[5], errors)
  const resolvedCount = settledDashboardField('resolvedCount', results[6], errors)
  const selectedCall = settledDashboardField('selectedCall', results[7], errors)
  const events = settledDashboardField('events', results[8], errors)
  const statusCounts: Partial<Record<ServiceCallStatus, number>> = {
    ...(pendingCount !== undefined ? { pending: pendingCount } : {}),
    ...(inProgressCount !== undefined ? { in_progress: inProgressCount } : {}),
    ...(resolvedCount !== undefined ? { resolved: resolvedCount } : {}),
  }
  return {
    ...(pending ? { pending } : {}),
    ...(inProgress ? { inProgress } : {}),
    ...(resolved ? { resolved } : {}),
    ...(team ? { team } : {}),
    ...(pendingCount !== undefined ? { pendingCount } : {}),
    ...(Object.keys(statusCounts).length ? { statusCounts } : {}),
    ...(selectedCall !== undefined ? { selectedCall } : {}),
    ...(events !== undefined ? { events } : {}),
    errors,
  }
}

export async function listServiceCallEvents(input: unknown): Promise<ServiceCallEventDTO[]> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase
    .from('service_call_events')
    .select('id, call_id, restaurant_id, event_type, actor_id, previous_assignee_id, next_assignee_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('call_id', callId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw new Error(`Não foi possível carregar o histórico do chamado: ${error.message}`)
  return (data ?? []).map(serviceCallEventFromRow).filter((event): event is ServiceCallEventDTO => event !== null)
}

export async function listServiceCallTeam(input: unknown): Promise<ServiceCallTeamMemberDTO[]> {
  const { restaurantId } = serviceCallRestaurantSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase.rpc('list_restaurant_members', { p_restaurant_id: restaurantId })
  if (error) throw new Error(`Não foi possível carregar a equipe: ${error.message}`)
  return (data ?? []).flatMap((row) => {
    const role = memberRoleSchema.safeParse(row.member_role)
    if (!role.success) return []
    return [{
      userId: row.user_id,
      displayName: row.display_name?.trim() || 'Membro da equipe',
      role: role.data,
    }]
  })
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
    console.error('[service-calls] shell count failed', error instanceof Error ? error.message : error)
    return 0
  }
}

export async function getServiceCall(input: unknown): Promise<ServiceCallDTO | null> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireMember(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, restaurant_id, tag_id, table_number, status, created_at, first_claimed_at, first_claimed_by, assigned_to, resolved_at, resolved_by')
    .eq('restaurant_id', restaurantId)
    .eq('id', callId)
    .maybeSingle()
  if (error) throw new Error(`Não foi possível localizar o chamado: ${error.message}`)
  return data ? serviceCallFromRow(data) : null
}

export async function claimServiceCall(
  input: unknown,
): Promise<ServiceCallMutationResult<ClaimServiceCallOutcome>> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireUser()
  const supabase = await db()
  const { data, error } = await supabase.rpc('claim_service_call', { p_call_id: callId })
  if (error) throw mapServiceCallRpcError(error.message)
  return parseMutationResult(data, restaurantId, ['claimed', 'already_assigned', 'claim_conflict'])
}

export async function transferServiceCall(
  input: unknown,
): Promise<ServiceCallMutationResult<TransferServiceCallOutcome>> {
  const { restaurantId, callId, assigneeId } = transferServiceCallSchema.parse(input)
  await requireUser()
  const supabase = await db()
  const { data, error } = await supabase.rpc('transfer_service_call', {
    p_call_id: callId,
    p_assignee_id: assigneeId,
  })
  if (error) throw mapServiceCallRpcError(error.message)
  return parseMutationResult(data, restaurantId, ['transferred', 'already_assigned', 'transfer_conflict'])
}

export async function resolveServiceCall(
  input: unknown,
): Promise<ServiceCallMutationResult<ResolveServiceCallOutcome>> {
  const { restaurantId, callId } = serviceCallRefSchema.parse(input)
  await requireUser()
  const supabase = await db()
  const { data, error } = await supabase.rpc('resolve_service_call', { p_call_id: callId })
  if (error) throw mapServiceCallRpcError(error.message)
  return parseMutationResult(data, restaurantId, ['resolved', 'already_resolved', 'resolve_conflict'])
}

function parseMutationResult<TOutcome extends string>(
  value: unknown,
  restaurantId: string,
  outcomes: readonly TOutcome[],
): ServiceCallMutationResult<TOutcome> {
  const row = Array.isArray(value) ? value[0] : null
  if (!row || typeof row !== 'object') throw new Error('A operação não retornou o chamado atualizado.')
  const result = row as Record<string, unknown>
  const call = serviceCallFromRow({
    id: result.call_id,
    restaurant_id: result.restaurant_id,
    tag_id: result.tag_id,
    table_number: result.table_number,
    status: result.status,
    created_at: result.created_at,
    first_claimed_at: result.first_claimed_at,
    first_claimed_by: result.first_claimed_by,
    assigned_to: result.assigned_to,
    resolved_at: result.resolved_at,
    resolved_by: result.resolved_by,
  })
  if (!call || call.restaurantId !== restaurantId || typeof result.outcome !== 'string' || !outcomes.includes(result.outcome as TOutcome)) {
    throw new Error('A operação retornou um estado de chamado inválido.')
  }
  return { outcome: result.outcome as TOutcome, call }
}

function mapServiceCallRpcError(message: string): UserFacingError | Error {
  if (message === 'service_call_not_found') return new UserFacingError('Este chamado não existe mais.')
  if (message === 'service_call_invalid_assignee') return new UserFacingError('A pessoa selecionada não faz mais parte desta equipe.')
  if (message === 'forbidden') return new UserFacingError('Você não tem permissão para esta operação.')
  return new Error(`Não foi possível atualizar o chamado: ${message}`)
}
