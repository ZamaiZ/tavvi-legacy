import { z } from 'zod'
import { timestampSchema, uuidSchema } from './common'
import { tagTokenSchema } from './tag'

export const requestServiceCallSchema = z.object({ token: tagTokenSchema })
export const serviceCallStatusSchema = z.enum(['pending', 'resolved'])
export const serviceCallRestaurantSchema = z.object({ restaurantId: uuidSchema })
export const listServiceCallsSchema = z.object({
  restaurantId: uuidSchema,
  status: serviceCallStatusSchema,
  cursor: z.object({ createdAt: timestampSchema, id: uuidSchema }).optional(),
})
export const serviceCallRefSchema = z.object({ restaurantId: uuidSchema, callId: uuidSchema })

export type ServiceCallDTO = {
  id: string
  restaurantId: string
  tagId: string
  tableNumber: number
  status: 'pending' | 'resolved'
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

export type ServiceCallPage = { items: ServiceCallDTO[]; hasMore: boolean; nextCursor: { createdAt: string; id: string } | null }
export type ServiceCallRequest = { callId: string; tableNumber: number; status: 'pending'; created: boolean }

export function serviceCallFromRow(value: unknown): ServiceCallDTO | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const status = serviceCallStatusSchema.safeParse(row.status)
  const createdAt = timestampSchema.safeParse(row.created_at)
  if (
    typeof row.id !== 'string' || !uuidSchema.safeParse(row.id).success ||
    typeof row.restaurant_id !== 'string' || !uuidSchema.safeParse(row.restaurant_id).success ||
    typeof row.tag_id !== 'string' || !uuidSchema.safeParse(row.tag_id).success ||
    typeof row.table_number !== 'number' || !Number.isInteger(row.table_number) || row.table_number < 1 ||
    !status.success || !createdAt.success
  ) return null
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    tagId: row.tag_id,
    tableNumber: row.table_number,
    status: status.data,
    createdAt: createdAt.data,
    resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
    resolvedBy: typeof row.resolved_by === 'string' ? row.resolved_by : null,
  }
}
