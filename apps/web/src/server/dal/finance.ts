import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  cashDenominations,
  cashDayHistoryPageSchema,
  cashDayMovementSchema,
  closeCashDaySchema,
  financePeriodSchema,
  openCashDaySchema,
  type BRLDenomination,
  type CashDayDTO,
  type CashDayCarriedAccountDTO,
  type CashDayDetailDTO,
  type CashDayHistoryItemDTO,
  type CashDayHistoryPageDTO,
  type CashDayMovementDTO,
  type DenominationCount,
  type FinanceDashboardDTO,
  type FinanceMethodSummaryDTO,
  type LegacyFinanceReportDTO,
  type FinanceTotalsDTO,
} from '@/domain/finance'
import type { Json, Tables } from '@/domain/database.types'
import { currentTerritory, UserFacingError, myRole } from '@/server/dal/auth'
import { createUserClient } from './_client'
import { listCashAccounts, listPendingCashAccounts } from './table-accounts'

type Db = Awaited<ReturnType<typeof createUserClient>>
type CashDayRow = Tables<'restaurant_cash_days'>
type PaymentRow = Pick<Tables<'table_account_payments'>,
  'id' | 'method_id' | 'method_name' | 'entry_type' | 'amount_applied_cents' | 'created_at' | 'cash_day_id'
>
type MovementRow = Tables<'cash_day_movements'>
type PaymentMethodRow = Pick<Tables<'restaurant_payment_methods'>, 'id' | 'method_type'>

const PAGE_SIZE = 1000

async function getClient() {
  return createUserClient(await currentTerritory())
}

async function ensureFinanceRole(restaurantId: string): Promise<'admin' | 'cashier'> {
  const role = await myRole(restaurantId)
  if (role !== 'admin' && role !== 'cashier') {
    throw new UserFacingError('O Financeiro está disponível apenas para administração e caixa.')
  }
  return role
}

function safeCents(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new Error('Um total financeiro excede o limite aceito.')
  }
  return value
}

function mapDenominationCount(value: Json | null): DenominationCount | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const count: DenominationCount = {}
  for (const [denomination, quantity] of Object.entries(value)) {
    if (cashDenominations.includes(denomination as BRLDenomination)
      && typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 0) {
      count[denomination as BRLDenomination] = quantity
    }
  }
  return count
}

function mapCashDay(row: CashDayRow): CashDayDTO {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    status: row.status as 'open' | 'closed',
    openedAt: row.opened_at,
    openedBy: row.opened_by,
    openingCashCents: row.opening_cash_cents,
    openingCount: mapDenominationCount(row.opening_count),
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    expectedCashCents: row.expected_cash_cents,
    countedCashCents: row.counted_cash_cents,
    cashDifferenceCents: row.cash_difference_cents,
    closingCount: mapDenominationCount(row.closing_count),
    differenceReason: row.difference_reason,
    exceptionReason: row.exception_reason,
  }
}

function mapMovement(row: MovementRow): CashDayMovementDTO {
  return {
    id: row.id,
    cashDayId: row.cash_day_id,
    type: row.movement_type as CashDayMovementDTO['type'],
    amountCents: row.amount_cents,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

async function fetchAll<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await load(offset, offset + PAGE_SIZE - 1)
    if (page.error) throw new Error(`${label}: ${page.error.message}`)
    const rows = page.data ?? []
    result.push(...rows)
    if (rows.length < PAGE_SIZE) return result
  }
}

async function loadDayFigures(
  db: Db,
  restaurantId: string,
  day: CashDayDTO,
  requestedFrom: string | null,
  requestedTo: string | null,
  movements: CashDayMovementDTO[],
): Promise<{ totals: FinanceTotalsDTO; methods: FinanceMethodSummaryDTO[] }> {
  const dayEnd = day.closedAt ?? new Date().toISOString()
  const from = requestedFrom && Date.parse(requestedFrom) > Date.parse(day.openedAt) ? requestedFrom : day.openedAt
  const to = requestedTo && Date.parse(requestedTo) < Date.parse(dayEnd) ? requestedTo : dayEnd

  const allPayments = await fetchAll<PaymentRow>(
    (offset, limit) => db.from('table_account_payments')
      .select('id, method_id, method_name, entry_type, amount_applied_cents, created_at, cash_day_id')
      .eq('restaurant_id', restaurantId).eq('cash_day_id', day.id)
      .order('created_at').order('id').range(offset, limit),
    'Não foi possível carregar os recebimentos do caixa',
  )
  const payments = allPayments.filter((payment) =>
    Date.parse(payment.created_at) >= Date.parse(from) && Date.parse(payment.created_at) <= Date.parse(to))

  const methodTotals = new Map<string, FinanceMethodSummaryDTO>()
  let receivedCents = 0
  let refundedCents = 0
  for (const payment of payments) {
    const summary = methodTotals.get(payment.method_id) ?? {
      methodId: payment.method_id, methodName: payment.method_name, receivedCents: 0, refundedCents: 0,
    }
    if (payment.entry_type === 'received') {
      summary.receivedCents += payment.amount_applied_cents
      receivedCents += payment.amount_applied_cents
    } else {
      summary.refundedCents += payment.amount_applied_cents
      refundedCents += payment.amount_applied_cents
    }
    methodTotals.set(payment.method_id, summary)
  }

  const orders = await fetchAll<Pick<Tables<'orders'>, 'id'>>(
    (offset, limit) => {
      let query = db.from('orders').select('id').eq('restaurant_id', restaurantId).gte('created_at', from).order('created_at').order('id')
      if (to) query = query.lte('created_at', to)
      return query.range(offset, limit)
    },
    'Não foi possível carregar as vendas do período',
  )
  const orderIds = orders.map((order) => order.id)
  let consumptionSalesCents = 0
  for (let offset = 0; offset < orderIds.length; offset += 200) {
    const batch = orderIds.slice(offset, offset + 200)
    const items = await fetchAll<Pick<Tables<'order_items'>, 'line_total_cents' | 'cancelled_at'>>(
      (fromIndex, toIndex) => db.from('order_items').select('line_total_cents, cancelled_at')
        .eq('restaurant_id', restaurantId).in('order_id', batch).order('order_id').order('id').range(fromIndex, toIndex),
      'Não foi possível somar as vendas do período',
    )
    consumptionSalesCents += items.reduce((sum, item) => sum + (item.cancelled_at ? 0 : item.line_total_cents), 0)
  }

  let tipsQuery = db.from('table_accounts').select('tip_amount_cents')
    .eq('restaurant_id', restaurantId).eq('tip_accepted', true).gte('tip_decided_at', from)
  if (to) tipsQuery = tipsQuery.lte('tip_decided_at', to)
  const tips = await fetchAll<Pick<Tables<'table_accounts'>, 'tip_amount_cents'>>(
    (offset, limit) => tipsQuery.order('id').range(offset, limit),
    'Não foi possível carregar as gorjetas do período',
  )
  const grossTipsCents = tips.reduce((sum, account) => sum + account.tip_amount_cents, 0)

  const methodTypes = await fetchAll<PaymentMethodRow>(
    (offset, limit) => db.from('restaurant_payment_methods').select('id, method_type')
      .eq('restaurant_id', restaurantId).order('id').range(offset, limit),
    'Não foi possível carregar os meios de pagamento',
  )
  const cashMethodIds = new Set(methodTypes.filter((method) => method.method_type === 'cash').map((method) => method.id))
  let cashReceipts = 0
  let cashRefunds = 0
  for (const payment of allPayments) {
    if (!cashMethodIds.has(payment.method_id)) continue
    if (payment.entry_type === 'received') cashReceipts += payment.amount_applied_cents
    else cashRefunds += payment.amount_applied_cents
  }
  const movementBalance = movements.reduce((sum, movement) =>
    sum + (movement.type === 'replenishment' ? movement.amountCents : -movement.amountCents), 0)
  const expectedCashCents = day.status === 'closed' && day.expectedCashCents !== null
    ? day.expectedCashCents
    : safeCents(day.openingCashCents + cashReceipts - cashRefunds + movementBalance)

  return {
    totals: {
      consumptionSalesCents: safeCents(consumptionSalesCents),
      grossTipsCents: safeCents(grossTipsCents),
      receivedCents: safeCents(receivedCents),
      refundedCents: safeCents(refundedCents),
      expectedCashCents,
    },
    methods: [...methodTotals.values()].sort((a, b) => a.methodName.localeCompare(b.methodName, 'pt-BR')),
  }
}

function mapHistory(day: CashDayDTO): CashDayHistoryItemDTO {
  return {
    id: day.id, status: day.status, openedAt: day.openedAt, openedBy: day.openedBy,
    closedAt: day.closedAt, closedBy: day.closedBy, openingCashCents: day.openingCashCents,
    expectedCashCents: day.expectedCashCents, countedCashCents: day.countedCashCents,
    cashDifferenceCents: day.cashDifferenceCents, exceptionReason: day.exceptionReason,
    differenceReason: day.differenceReason,
  }
}

export async function getFinanceDashboard(input: unknown): Promise<FinanceDashboardDTO> {
  const data = financePeriodSchema.parse(input)
  await ensureFinanceRole(data.restaurantId)
  const db = await getClient()
  const [activeResult, historyResult, pendingReceivables, accountLists, timezoneResult] = await Promise.all([
    db.from('restaurant_cash_days').select('*').eq('restaurant_id', data.restaurantId).eq('status', 'open').maybeSingle(),
    db.from('restaurant_cash_days').select('*').eq('restaurant_id', data.restaurantId)
      .order('opened_at', { ascending: false }).order('id', { ascending: false }).limit(31),
    listPendingCashAccounts(data.restaurantId),
    listCashAccounts(data.restaurantId),
    db.from('restaurants').select('timezone').eq('id', data.restaurantId).single(),
  ])
  if (activeResult.error) throw new Error(`Não foi possível carregar o dia de caixa: ${activeResult.error.message}`)
  if (historyResult.error) throw new Error(`Não foi possível carregar o histórico financeiro: ${historyResult.error.message}`)
  if (timezoneResult.error || !timezoneResult.data) throw new Error('Não foi possível carregar o fuso horário do restaurante.')
  const activeDay = activeResult.data ? mapCashDay(activeResult.data) : null
  let totals: FinanceTotalsDTO = {
    consumptionSalesCents: 0, grossTipsCents: 0, receivedCents: 0, refundedCents: 0,
    expectedCashCents: activeDay?.openingCashCents ?? 0,
  }
  let methods: FinanceMethodSummaryDTO[] = []
  let movements: CashDayMovementDTO[] = []
  if (activeDay) {
    const movementResult = await db.from('cash_day_movements').select('*').eq('cash_day_id', activeDay.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
    if (movementResult.error) throw new Error(`Não foi possível carregar as movimentações: ${movementResult.error.message}`)
    movements = (movementResult.data ?? []).map(mapMovement)
    const figures = await loadDayFigures(db, data.restaurantId, activeDay, data.from ?? null, data.to ?? null, movements)
    totals = figures.totals
    methods = figures.methods
  }
  return {
    timezone: timezoneResult.data.timezone,
    activeDay,
    totals,
    methods,
    accountsBlockingClose: accountLists.active,
    pendingReceivables,
    movements,
    history: (historyResult.data ?? []).slice(0, 30).map((row) => mapHistory(mapCashDay(row))),
    historyHasMore: (historyResult.data ?? []).length > 30,
    period: { from: data.from ?? activeDay?.openedAt ?? null, to: data.to ?? (activeDay ? new Date().toISOString() : null) },
  }
}

export async function getCashDayHistoryPage(input: unknown): Promise<CashDayHistoryPageDTO> {
  const data = cashDayHistoryPageSchema.parse(input)
  await ensureFinanceRole(data.restaurantId)
  const db = await getClient()
  const { data: rows, error } = await db.from('restaurant_cash_days').select('*')
    .eq('restaurant_id', data.restaurantId)
    .order('opened_at', { ascending: false }).order('id', { ascending: false })
    .range(data.offset, data.offset + 30)
  if (error) throw new Error(`Não foi possível carregar o histórico financeiro: ${error.message}`)
  const pageRows = rows ?? []
  const hasMore = pageRows.length > 30
  return {
    history: pageRows.slice(0, 30).map((row) => mapHistory(mapCashDay(row))),
    hasMore,
    nextOffset: hasMore ? data.offset + 30 : null,
  }
}

export async function getLegacyFinanceReport(input: unknown): Promise<LegacyFinanceReportDTO> {
  const data = financePeriodSchema.parse(input)
  await ensureFinanceRole(data.restaurantId)
  const db = await getClient()
  const { data: result, error } = await db.rpc('legacy_restaurant_finance_report', {
    p_restaurant_id: data.restaurantId,
    p_from: data.from ?? null,
    p_to: data.to ?? null,
  })
  if (error || !result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(`Não foi possível carregar o panorama histórico: ${error?.message ?? 'resposta inválida'}`)
  }
  const report = result as unknown as {
    timezone: string
    evaluatedAt: string
    hasHistory: boolean
    consumptionSalesCents: number
    grossTipsCents: number
    receivedCents: number
    refundedCents: number
    methods: Array<{
      methodId: string
      methodName: string
      receivedCents: number
      refundedCents: number
    }>
  }
  if (typeof report.timezone !== 'string' || typeof report.evaluatedAt !== 'string'
    || typeof report.hasHistory !== 'boolean' || !Array.isArray(report.methods)) {
    throw new Error('Não foi possível interpretar o panorama histórico do restaurante.')
  }

  return {
    timezone: report.timezone,
    evaluatedAt: report.evaluatedAt,
    hasHistory: report.hasHistory,
    totals: {
      consumptionSalesCents: safeCents(report.consumptionSalesCents),
      grossTipsCents: safeCents(report.grossTipsCents),
      receivedCents: safeCents(report.receivedCents),
      refundedCents: safeCents(report.refundedCents),
    },
    methods: report.methods.map((method) => ({
      methodId: method.methodId,
      methodName: method.methodName,
      receivedCents: safeCents(method.receivedCents),
      refundedCents: safeCents(method.refundedCents),
    })).sort((a, b) => a.methodName.localeCompare(b.methodName, 'pt-BR')),
  }
}

export async function getCashDayDetails(input: { restaurantId: unknown; cashDayId: unknown }): Promise<CashDayDetailDTO | null> {
  const restaurantId = uuidSchema.parse(input.restaurantId)
  const cashDayId = uuidSchema.parse(input.cashDayId)
  await ensureFinanceRole(restaurantId)
  const db = await getClient()
  const { data: row, error } = await db.from('restaurant_cash_days').select('*')
    .eq('restaurant_id', restaurantId).eq('id', cashDayId).maybeSingle()
  if (error) throw new Error(`Não foi possível abrir o detalhe do caixa: ${error.message}`)
  if (!row) return null
  const day = mapCashDay(row)
  const movementResult = await db.from('cash_day_movements').select('*').eq('cash_day_id', day.id)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  if (movementResult.error) throw new Error(`Não foi possível carregar as movimentações: ${movementResult.error.message}`)
  const movements = (movementResult.data ?? []).map(mapMovement)
  const [pendingReceivables, accountLists, carriedAccounts] = await Promise.all([
    listPendingCashAccounts(restaurantId, day.id),
    listCashAccounts(restaurantId),
    day.exceptionReason ? loadCarriedAccounts(db, restaurantId, day.id) : Promise.resolve<CashDayCarriedAccountDTO[]>([]),
  ])
  const figures = await loadDayFigures(db, restaurantId, day, null, null, movements)
  return {
    ...day, totals: figures.totals, methods: figures.methods, movements,
    accountsBlockingClose: day.status === 'open' ? accountLists.active : [], pendingReceivables, carriedAccounts,
  }
}

async function loadCarriedAccounts(db: Db, restaurantId: string, cashDayId: string): Promise<CashDayCarriedAccountDTO[]> {
  const events = await fetchAll<Pick<Tables<'table_account_events'>, 'table_account_id' | 'details'>>(
    (offset, limit) => db.from('table_account_events').select('table_account_id, details')
      .eq('restaurant_id', restaurantId).eq('event_type', 'account_carried_to_pending')
      .contains('details', { cashDayId }).order('table_account_id').range(offset, limit),
    'Não foi possível carregar os saldos transportados no fechamento',
  )
  const snapshots = events.flatMap((event) => {
    const details = event.details
    if (!details || typeof details !== 'object' || Array.isArray(details)) return []
    const balance = details.balanceDueCents
    return typeof balance === 'number' && Number.isSafeInteger(balance) && balance >= 0
      ? [{ accountId: event.table_account_id, balanceAtCloseCents: balance }]
      : []
  })
  const accountById = new Map<string, Pick<Tables<'table_accounts'>, 'id' | 'table_number' | 'account_name' | 'walk_in_number' | 'status'>>()
  for (let offset = 0; offset < snapshots.length; offset += 200) {
    const batch = snapshots.slice(offset, offset + 200).map((snapshot) => snapshot.accountId)
    const accounts = await fetchAll<Pick<Tables<'table_accounts'>, 'id' | 'table_number' | 'account_name' | 'walk_in_number' | 'status'>>(
      (from, to) => db.from('table_accounts').select('id, table_number, account_name, walk_in_number, status')
        .eq('restaurant_id', restaurantId).in('id', batch).order('id').range(from, to),
      'Não foi possível carregar as comandas transportadas',
    )
    for (const account of accounts) accountById.set(account.id, account)
  }
  return snapshots.flatMap((snapshot) => {
    const account = accountById.get(snapshot.accountId)
    if (!account || (account.status !== 'pending' && account.status !== 'closed')) return []
    const currentStatus: CashDayCarriedAccountDTO['currentStatus'] = account.status
    return [{
      accountId: account.id,
      tableNumber: account.table_number,
      accountName: account.account_name,
      walkInNumber: account.walk_in_number,
      balanceAtCloseCents: snapshot.balanceAtCloseCents,
      currentStatus,
    }]
  }).sort((a, b) => (a.tableNumber ?? Number.MAX_SAFE_INTEGER) - (b.tableNumber ?? Number.MAX_SAFE_INTEGER)
    || (a.walkInNumber ?? Number.MAX_SAFE_INTEGER) - (b.walkInNumber ?? Number.MAX_SAFE_INTEGER))
}

function throwRpcError(error: { message: string }): never {
  const messages: [string, string][] = [
    ['forbidden', 'Você não tem permissão para esta operação.'],
    ['cash_day_already_open', 'Já existe um caixa aberto neste restaurante.'],
    ['cash_day_not_open', 'Abra um caixa antes de receber ou estornar pagamentos.'],
    ['cash_day_not_found', 'O período de caixa não foi encontrado.'],
    ['cash_day_closed', 'Este caixa já foi fechado. Abra um novo período para continuar.'],
    ['cash_day_insufficient_cash', 'A movimentação ou devolução em espécie excede o dinheiro disponível no caixa.'],
    ['cash_day_difference_reason_required', 'Informe o motivo da diferença entre o valor esperado e a contagem.'],
    ['cash_day_exception_admin_only', 'Somente a administração pode fechar com comandas em aberto.'],
    ['cash_day_exception_reason_required', 'Informe o motivo para fechar com comandas em aberto.'],
    ['cash_day_open_accounts', 'Há comandas abertas. Finalize-as ou use o fechamento excepcional da administração.'],
    ['cash_day_open_input_invalid', 'Confira o valor e a contagem do fundo inicial.'],
    ['cash_day_movement_input_invalid', 'Confira o tipo, valor e motivo da movimentação.'],
    ['cash_day_close_input_invalid', 'Confira a contagem do caixa e os motivos informados.'],
    ['cash_day_expected_cash_invalid', 'O saldo esperado ficou fora do limite aceito. Revise as movimentações.'],
    ['cash_day_open_accounts:', 'Há comandas abertas. Finalize-as ou use o fechamento excepcional da administração.'],
    ['duplicate_request', 'A solicitação já foi usada com outros dados. Atualize a página antes de tentar novamente.'],
  ]
  const found = messages.find(([code]) => error.message.includes(code))
  if (found) throw new UserFacingError(found[1])
  throw new Error(`Não foi possível atualizar o caixa: ${error.message}`)
}

export async function openCashDay(input: unknown): Promise<FinanceDashboardDTO> {
  const data = openCashDaySchema.parse(input)
  await ensureFinanceRole(data.restaurantId)
  const db = await getClient()
  const { error } = await db.rpc('open_restaurant_cash_day', {
    p_restaurant_id: data.restaurantId,
    p_opening_cash_cents: data.openingCashCents,
    p_opening_count: (data.openingCount ?? null) as Json,
    p_request_id: data.requestId,
  })
  if (error) throwRpcError(error)
  return getFinanceDashboard({ restaurantId: data.restaurantId })
}

export async function recordCashDayMovement(input: unknown): Promise<FinanceDashboardDTO> {
  const data = cashDayMovementSchema.parse(input)
  await ensureFinanceRole(data.restaurantId)
  const db = await getClient()
  const { data: day, error: dayError } = await db.from('restaurant_cash_days').select('id')
    .eq('restaurant_id', data.restaurantId).eq('id', data.cashDayId).maybeSingle()
  if (dayError) throw new Error(`Não foi possível conferir o caixa: ${dayError.message}`)
  if (!day) throw new UserFacingError('Este período não pertence ao restaurante selecionado.')
  const { error } = await db.rpc('record_cash_day_movement', {
    p_cash_day_id: data.cashDayId,
    p_movement_type: data.type,
    p_amount_cents: data.amountCents,
    p_reason: data.reason,
    p_request_id: data.requestId,
  })
  if (error) throwRpcError(error)
  return getFinanceDashboard({ restaurantId: data.restaurantId })
}

export async function closeCashDay(input: unknown): Promise<FinanceDashboardDTO> {
  const data = closeCashDaySchema.parse(input)
  const role = await ensureFinanceRole(data.restaurantId)
  if (data.exceptionReason && role !== 'admin') {
    throw new UserFacingError('Somente a administração pode fechar com comandas em aberto.')
  }
  const db = await getClient()
  const { data: day, error: dayError } = await db.from('restaurant_cash_days').select('id')
    .eq('restaurant_id', data.restaurantId).eq('id', data.cashDayId).maybeSingle()
  if (dayError) throw new Error(`Não foi possível conferir o caixa: ${dayError.message}`)
  if (!day) throw new UserFacingError('Este período não pertence ao restaurante selecionado.')
  const { error } = await db.rpc('close_restaurant_cash_day', {
    p_cash_day_id: data.cashDayId,
    p_counted_cash_cents: data.countedCashCents,
    p_closing_count: (data.closingCount ?? null) as Json,
    p_difference_reason: data.differenceReason ?? '',
    p_exception_reason: data.exceptionReason ?? '',
    p_request_id: data.requestId,
  })
  if (error) throwRpcError(error)
  return getFinanceDashboard({ restaurantId: data.restaurantId })
}
