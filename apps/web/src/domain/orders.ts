import { z } from 'zod'
import { uuidSchema } from './common'
import { tableAccountSummarySchema } from './table-account'

export type OrderableMenuItemDTO = {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePriceCents: number
  variants: { id: string; name: string; priceCents: number }[]
}

export type OrderableMenuCategoryDTO = {
  id: string
  name: string
  items: OrderableMenuItemDTO[]
}

const orderLineInputSchema = z.object({
  itemId: uuidSchema,
  variantId: uuidSchema.nullable(),
  quantity: z.int().min(1).max(99),
  expectedUnitPriceCents: z.int().min(0).max(2_147_483_647),
  note: z.string().trim().max(1000).optional().default(''),
}).strict()

export const recordTableOrderSchema = z.object({
  restaurantId: uuidSchema,
  callId: uuidSchema,
  requestId: uuidSchema,
  items: z.array(orderLineInputSchema).min(1).max(40),
})

export type RecordTableOrderInput = z.infer<typeof recordTableOrderSchema>

export const recordTableOrderResultSchema = tableAccountSummarySchema.extend({
  outcome: z.enum(['recorded', 'already_recorded']),
  orderId: uuidSchema,
})
export type RecordTableOrderResult = z.infer<typeof recordTableOrderResultSchema>
