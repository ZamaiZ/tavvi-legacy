import { z } from 'zod'
import { plainTextSchema, uuidSchema } from './common'

const amountCentsSchema = z.int().min(0).max(2_147_483_647)

export const accountStatusSchema = z.enum(['open', 'settling', 'closed'])
export type TableAccountStatus = z.infer<typeof accountStatusSchema>

export const tipModeSchema = z.enum(['disabled', 'percentage', 'fixed'])
export type TipMode = z.infer<typeof tipModeSchema>

export const paymentMethodTypeSchema = z.enum([
  'cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher',
  'voucher', 'partnership', 'other', 'custom',
])
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>

export const tableAccountSummarySchema = z.object({
  accountId: uuidSchema,
  restaurantId: uuidSchema,
  tableNumber: z.int().positive(),
  status: accountStatusSchema,
  tipMode: tipModeSchema,
  tipPercentBps: z.int().nullable(),
  tipFixedCents: z.int().nullable(),
  tipAccepted: z.boolean().nullable(),
  tipAmountCents: amountCentsSchema,
  openedAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
  subtotalCents: amountCentsSchema,
  tipCents: amountCentsSchema,
  totalCents: amountCentsSchema,
  paidCents: amountCentsSchema,
  balanceDueCents: amountCentsSchema,
})
export type TableAccountSummaryDTO = z.infer<typeof tableAccountSummarySchema>

export type OrderItemDTO = {
  id: string
  itemName: string
  categoryName: string
  variantName: string | null
  quantity: number
  note: string | null
  unitPriceCents: number
  lineTotalCents: number
  cancelledAt: string | null
  cancelledBy: string | null
  cancelReason: string | null
}

export type OrderDTO = {
  id: string
  serviceCallId: string
  createdBy: string
  createdAt: string
  items: OrderItemDTO[]
}

export type AccountPaymentDTO = {
  id: string
  methodId: string
  methodName: string
  entryType: 'received' | 'refunded'
  amountAppliedCents: number
  cashReceivedCents: number | null
  cashChangeCents: number
  reversesPaymentId: string | null
  reference: string | null
  reason: string | null
  createdBy: string
  createdAt: string
}

export type TableAccountEventDTO = {
  id: string
  eventType: string
  actorId: string
  reason: string | null
  details: Record<string, unknown>
  createdAt: string
}

export type TableAccountDTO = TableAccountSummaryDTO & {
  openedBy: string
  closedBy: string | null
  tipDecidedAt: string | null
  orders: OrderDTO[]
  payments: AccountPaymentDTO[]
  events: TableAccountEventDTO[]
}

export type PaymentMethodDTO = {
  id: string
  methodType: PaymentMethodType
  name: string
  isActive: boolean
  position: number
}

export type CheckoutSettingsDTO = {
  tipMode: TipMode
  tipPercentBps: number | null
  tipFixedCents: number | null
  paymentMethods: PaymentMethodDTO[]
}

export const recordTablePaymentSchema = z.object({
  restaurantId: uuidSchema,
  accountId: uuidSchema,
  methodId: uuidSchema,
  requestId: uuidSchema,
  amountAppliedCents: z.int().positive().max(2_147_483_647),
  cashReceivedCents: z.int().positive().max(2_147_483_647).nullable().optional(),
})

export const decideTipSchema = z.object({
  restaurantId: uuidSchema,
  accountId: uuidSchema,
  tipAccepted: z.boolean(),
  requestId: uuidSchema,
})

export const reopenAccountSchema = z.object({
  restaurantId: uuidSchema,
  accountId: uuidSchema,
  reason: plainTextSchema(500, 3),
  requestId: uuidSchema,
})

export const reversePaymentSchema = z.object({
  restaurantId: uuidSchema,
  paymentId: uuidSchema,
  amountCents: z.int().positive().max(2_147_483_647),
  reason: plainTextSchema(500, 3),
  requestId: uuidSchema,
})

export const cancelOrderItemSchema = z.object({
  restaurantId: uuidSchema,
  orderItemId: uuidSchema,
  reason: plainTextSchema(500, 3),
  requestId: uuidSchema,
})

export const checkoutSettingsInputSchema = z.object({
  restaurantId: uuidSchema,
  tipMode: tipModeSchema,
  tipPercentBps: z.int().min(1).max(10000).nullable(),
  tipFixedCents: z.int().positive().max(2_147_483_647).nullable(),
}).superRefine((value, context) => {
  const valid = value.tipMode === 'disabled'
    ? value.tipPercentBps === null && value.tipFixedCents === null
    : value.tipMode === 'percentage'
      ? value.tipPercentBps !== null && value.tipFixedCents === null
      : value.tipPercentBps === null && value.tipFixedCents !== null
  if (!valid) context.addIssue({ code: 'custom', message: 'Confira os valores da gorjeta.' })
})

export const savePaymentMethodSchema = z.object({
  restaurantId: uuidSchema,
  name: plainTextSchema(60, 1),
})

export const setPaymentMethodActiveSchema = z.object({
  restaurantId: uuidSchema,
  methodId: uuidSchema,
  isActive: z.boolean(),
})
