import { z } from 'zod'
import { plainTextSchema, uuidSchema } from './common'
import type { TableAccountSummaryDTO } from './table-account'

export const cashDenominations = [
  '0.05', '0.10', '0.25', '0.50', '1.00', '2.00', '5.00',
  '10.00', '20.00', '50.00', '100.00', '200.00',
] as const
export type BRLDenomination = typeof cashDenominations[number]
export type DenominationCount = Partial<Record<BRLDenomination, number>>

const amountSchema = z.int().min(0).max(2_147_483_647)
const countSchema = z.record(z.enum(cashDenominations), z.int().min(0).max(1_000_000)).optional().nullable()

export const financePeriodSchema = z.object({
  restaurantId: uuidSchema,
  from: z.iso.datetime({ offset: true }).nullable().optional(),
  to: z.iso.datetime({ offset: true }).nullable().optional(),
}).superRefine((value, context) => {
  if (value.from && value.to && Date.parse(value.from) > Date.parse(value.to)) {
    context.addIssue({ code: 'custom', message: 'O início do período deve ser anterior ao fim.' })
  }
})

export const openCashDaySchema = z.object({
  restaurantId: uuidSchema,
  openingCashCents: amountSchema,
  openingCount: countSchema,
  requestId: uuidSchema,
})

export const cashDayMovementSchema = z.object({
  restaurantId: uuidSchema,
  cashDayId: uuidSchema,
  type: z.enum(['replenishment', 'withdrawal']),
  amountCents: z.int().positive().max(2_147_483_647),
  reason: plainTextSchema(500, 3),
  requestId: uuidSchema,
})

export const closeCashDaySchema = z.object({
  restaurantId: uuidSchema,
  cashDayId: uuidSchema,
  countedCashCents: amountSchema,
  closingCount: countSchema,
  differenceReason: plainTextSchema(500).nullable().optional(),
  exceptionReason: plainTextSchema(500).nullable().optional(),
  requestId: uuidSchema,
})

export const cashDayHistoryPageSchema = z.object({
  restaurantId: uuidSchema,
  offset: z.int().min(30).max(100_000),
})

export type CashDayDTO = {
  id: string
  restaurantId: string
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string
  openingCashCents: number
  openingCount: DenominationCount | null
  closedAt: string | null
  closedBy: string | null
  expectedCashCents: number | null
  countedCashCents: number | null
  cashDifferenceCents: number | null
  closingCount: DenominationCount | null
  differenceReason: string | null
  exceptionReason: string | null
}

export type CashDayMovementDTO = {
  id: string
  cashDayId: string
  type: 'replenishment' | 'withdrawal'
  amountCents: number
  reason: string
  createdBy: string
  createdAt: string
}

export type CashDayHistoryItemDTO = Pick<CashDayDTO,
  'id' | 'status' | 'openedAt' | 'openedBy' | 'closedAt' | 'closedBy'
  | 'openingCashCents' | 'expectedCashCents' | 'countedCashCents'
  | 'cashDifferenceCents' | 'exceptionReason' | 'differenceReason'
>

export type FinanceMethodSummaryDTO = {
  methodId: string
  methodName: string
  receivedCents: number
  refundedCents: number
}

export type FinanceTotalsDTO = {
  consumptionSalesCents: number
  grossTipsCents: number
  receivedCents: number
  refundedCents: number
  expectedCashCents: number
}

export type FinanceDashboardDTO = {
  timezone: string
  activeDay: CashDayDTO | null
  totals: FinanceTotalsDTO
  methods: FinanceMethodSummaryDTO[]
  accountsBlockingClose: TableAccountSummaryDTO[]
  pendingReceivables: TableAccountSummaryDTO[]
  movements: CashDayMovementDTO[]
  history: CashDayHistoryItemDTO[]
  historyHasMore: boolean
  period: { from: string | null; to: string | null }
}

export type LegacyFinanceReportDTO = {
  timezone: string
  evaluatedAt: string
  hasHistory: boolean
  totals: Pick<FinanceTotalsDTO, 'consumptionSalesCents' | 'grossTipsCents' | 'receivedCents' | 'refundedCents'>
  methods: FinanceMethodSummaryDTO[]
}

export type CashDayDetailDTO = CashDayDTO & {
  totals: FinanceTotalsDTO
  methods: FinanceMethodSummaryDTO[]
  movements: CashDayMovementDTO[]
  accountsBlockingClose: TableAccountSummaryDTO[]
  pendingReceivables: TableAccountSummaryDTO[]
  carriedAccounts: CashDayCarriedAccountDTO[]
}

export type CashDayHistoryPageDTO = {
  history: CashDayHistoryItemDTO[]
  hasMore: boolean
  nextOffset: number | null
}

export type CashDayCarriedAccountDTO = {
  accountId: string
  tableNumber: number | null
  accountName: string | null
  walkInNumber: number | null
  balanceAtCloseCents: number
  currentStatus: 'pending' | 'closed'
}

export type OpenCashDayInput = z.infer<typeof openCashDaySchema>
export type RecordCashDayMovementInput = z.infer<typeof cashDayMovementSchema>
export type CloseCashDayInput = z.infer<typeof closeCashDaySchema>

