import { z } from 'zod'
import { timestampSchema, uuidSchema } from './common'
import { tagTokenSchema } from './tag'
import { memberRoleSchema } from './invite'

export const requestServiceCallSchema = z.object({ token: tagTokenSchema })
export const serviceCallStatusSchema = z.enum(['pending', 'in_progress', 'resolved'])
export const serviceCallEventTypeSchema = z.enum(['claimed', 'transferred', 'resolved'])
export const serviceCallRestaurantSchema = z.object({ restaurantId: uuidSchema })
export const listServiceCallsSchema = z.object({
  restaurantId: uuidSchema,
  status: serviceCallStatusSchema,
  cursor: z.object({ createdAt: timestampSchema, id: uuidSchema }).optional(),
})
export const serviceCallRefSchema = z.object({ restaurantId: uuidSchema, callId: uuidSchema })
export const transferServiceCallSchema = serviceCallRefSchema.extend({ assigneeId: uuidSchema })

export type ServiceCallStatus = z.infer<typeof serviceCallStatusSchema>
export type ServiceCallEventType = z.infer<typeof serviceCallEventTypeSchema>

export type ServiceCallDTO = {
  id: string
  restaurantId: string
  tagId: string
  tableNumber: number
  status: ServiceCallStatus
  createdAt: string
  firstClaimedAt: string | null
  firstClaimedBy: string | null
  assignedTo: string | null
  resolvedAt: string | null
  resolvedBy: string | null
}

export type ServiceCallEventDTO = {
  id: string
  callId: string
  restaurantId: string
  eventType: ServiceCallEventType
  actorId: string | null
  previousAssigneeId: string | null
  nextAssigneeId: string | null
  createdAt: string
}

export type ServiceCallTeamMemberDTO = {
  userId: string
  displayName: string
  role: z.infer<typeof memberRoleSchema>
}

export type ServiceCallPage = { items: ServiceCallDTO[]; hasMore: boolean; nextCursor: { createdAt: string; id: string } | null }
export type ServiceCallRequest = { callId: string; tableNumber: number; status: 'pending' | 'in_progress'; created: boolean }
export type ClaimServiceCallOutcome = 'claimed' | 'already_assigned' | 'claim_conflict'
export type TransferServiceCallOutcome = 'transferred' | 'already_assigned' | 'transfer_conflict'
export type ResolveServiceCallOutcome = 'resolved' | 'already_resolved' | 'resolve_conflict'
export type ServiceCallMutationResult<TOutcome extends string> = { outcome: TOutcome; call: ServiceCallDTO }

export function serviceCallFromRow(value: unknown): ServiceCallDTO | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const status = serviceCallStatusSchema.safeParse(row.status)
  const createdAt = timestampSchema.safeParse(row.created_at)
  const firstClaimedAt = nullableTimestamp(row.first_claimed_at)
  const resolvedAt = nullableTimestamp(row.resolved_at)
  const firstClaimedBy = nullableUuid(row.first_claimed_by)
  const assignedTo = nullableUuid(row.assigned_to)
  const resolvedBy = nullableUuid(row.resolved_by)
  if (
    typeof row.id !== 'string' || !uuidSchema.safeParse(row.id).success ||
    typeof row.restaurant_id !== 'string' || !uuidSchema.safeParse(row.restaurant_id).success ||
    typeof row.tag_id !== 'string' || !uuidSchema.safeParse(row.tag_id).success ||
    typeof row.table_number !== 'number' || !Number.isInteger(row.table_number) || row.table_number < 1 ||
    !status.success || !createdAt.success ||
    !firstClaimedAt.success || !resolvedAt.success ||
    !firstClaimedBy.success || !assignedTo.success || !resolvedBy.success
  ) return null
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tagId: row.tag_id,
    tableNumber: row.table_number,
    status: status.data,
    createdAt: createdAt.data,
    firstClaimedAt: firstClaimedAt.data,
    firstClaimedBy: firstClaimedBy.data,
    assignedTo: assignedTo.data,
    resolvedAt: resolvedAt.data,
    resolvedBy: resolvedBy.data,
  }
}

export function serviceCallEventFromRow(value: unknown): ServiceCallEventDTO | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const eventType = serviceCallEventTypeSchema.safeParse(row.event_type)
  const createdAt = timestampSchema.safeParse(row.created_at)
  const actorId = nullableUuid(row.actor_id)
  const previousAssigneeId = nullableUuid(row.previous_assignee_id)
  const nextAssigneeId = nullableUuid(row.next_assignee_id)
  if (
    typeof row.id !== 'string' || !uuidSchema.safeParse(row.id).success ||
    typeof row.call_id !== 'string' || !uuidSchema.safeParse(row.call_id).success ||
    typeof row.restaurant_id !== 'string' || !uuidSchema.safeParse(row.restaurant_id).success ||
    !eventType.success || !createdAt.success ||
    !actorId.success || !previousAssigneeId.success || !nextAssigneeId.success
  ) return null
  return {
    id: row.id,
    callId: row.call_id,
    restaurantId: row.restaurant_id,
    eventType: eventType.data,
    actorId: actorId.data,
    previousAssigneeId: previousAssigneeId.data,
    nextAssigneeId: nextAssigneeId.data,
    createdAt: createdAt.data,
  }
}

function nullableTimestamp(value: unknown) {
  return z.nullable(timestampSchema).safeParse(value)
}

function nullableUuid(value: unknown) {
  return z.nullable(uuidSchema).safeParse(value)
}
