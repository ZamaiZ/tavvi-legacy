import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  cancelOrderItemSchema,
  checkoutSettingsInputSchema,
  decideTipSchema,
  reopenAccountSchema,
  reversePaymentSchema,
  recordTablePaymentSchema,
  tableAccountSummarySchema,
  paymentMethodTypeSchema,
  type CheckoutSettingsDTO,
  type PaymentMethodDTO,
  type TableAccountSummaryDTO,
  type TableAccountDTO,
  savePaymentMethodSchema,
  setPaymentMethodActiveSchema,
} from '@/domain/table-account'
import type { Tables } from '@/domain/database.types'
import { currentTerritory, myRole, UserFacingError } from './auth'
import { createUserClient } from './_client'

type Db = Awaited<ReturnType<typeof createUserClient>>
type AccountRow = Tables<'table_accounts'>
type AccountSummaryRow = Pick<AccountRow,
  'id' | 'restaurant_id' | 'table_number' | 'status' | 'tip_mode' | 'tip_percent_bps'
  | 'tip_fixed_cents' | 'tip_accepted' | 'tip_amount_cents' | 'opened_at' | 'closed_at'
>

function ensureCashRole(role: string | null): asserts role is 'admin' | 'cashier' | 'attendant' | 'waiter' {
  if (!role) {
    throw new UserFacingError('Você não tem acesso às comandas deste restaurante.')
  }
}

async function getClient() {
  return createUserClient(await currentTerritory())
}

function safeCents(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new Error('O total da comanda excede o limite monetário aceito.')
  }
  return value
}

function objectDetails(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

const SUMMARY_PAGE_SIZE = 1000

async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  errorPrefix: string,
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += SUMMARY_PAGE_SIZE) {
    const { data, error } = await loadPage(offset, offset + SUMMARY_PAGE_SIZE - 1)
    if (error) throw new Error(`${errorPrefix}: ${error.message}`)
    const page = data ?? []
    rows.push(...page)
    if (page.length < SUMMARY_PAGE_SIZE) return rows
  }
}

async function hydrateAccounts(db: Db, rows: AccountRow[]): Promise<TableAccountDTO[]> {
  if (!rows.length) return []
  const accountIds = rows.map((row) => row.id)
  const [ordersResult, paymentsResult, eventsResult] = await Promise.all([
    db.from('orders').select('*').in('table_account_id', accountIds).order('created_at').order('id'),
    db.from('table_account_payments').select('*').in('table_account_id', accountIds).order('created_at').order('id'),
    db.from('table_account_events').select('*').in('table_account_id', accountIds).order('created_at').order('id'),
  ])
  if (ordersResult.error) throw new Error(`Não foi possível carregar pedidos da comanda: ${ordersResult.error.message}`)
  if (paymentsResult.error) throw new Error(`Não foi possível carregar pagamentos da comanda: ${paymentsResult.error.message}`)
  if (eventsResult.error) throw new Error(`Não foi possível carregar o histórico da comanda: ${eventsResult.error.message}`)

  const orderRows = ordersResult.data ?? []
  const orderIds = orderRows.map((order) => order.id)
  const { data: itemRows, error: itemsError } = orderIds.length
    ? await db.from('order_items').select('*').in('order_id', orderIds).order('position')
    : { data: [] as Tables<'order_items'>[], error: null }
  if (itemsError) throw new Error(`Não foi possível carregar os itens da comanda: ${itemsError.message}`)

  const itemsByOrder = new Map<string, Tables<'order_items'>[]>()
  for (const item of itemRows ?? []) {
    const group = itemsByOrder.get(item.order_id) ?? []
    group.push(item)
    itemsByOrder.set(item.order_id, group)
  }
  const ordersByAccount = new Map<string, NonNullable<typeof orderRows>>()
  for (const order of orderRows) {
    const group = ordersByAccount.get(order.table_account_id) ?? []
    group.push(order)
    ordersByAccount.set(order.table_account_id, group)
  }
  const paymentsByAccount = new Map<string, NonNullable<typeof paymentsResult.data>>()
  for (const payment of paymentsResult.data ?? []) {
    const group = paymentsByAccount.get(payment.table_account_id) ?? []
    group.push(payment)
    paymentsByAccount.set(payment.table_account_id, group)
  }
  const eventsByAccount = new Map<string, NonNullable<typeof eventsResult.data>>()
  for (const event of eventsResult.data ?? []) {
    const group = eventsByAccount.get(event.table_account_id) ?? []
    group.push(event)
    eventsByAccount.set(event.table_account_id, group)
  }

  return rows.map((row) => {
    const accountOrders = (ordersByAccount.get(row.id) ?? []).map((order) => ({
      id: order.id,
      serviceCallId: order.service_call_id,
      createdBy: order.created_by,
      createdAt: order.created_at,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        id: item.id,
        itemName: item.item_name,
        categoryName: item.category_name,
        variantName: item.variant_name,
        quantity: item.quantity,
        note: item.note,
        unitPriceCents: item.unit_price_cents,
        lineTotalCents: item.line_total_cents,
        cancelledAt: item.cancelled_at,
        cancelledBy: item.cancelled_by,
        cancelReason: item.cancel_reason,
      })),
    }))
    const payments = paymentsByAccount.get(row.id) ?? []
    const subtotal = accountOrders.reduce((sum, order) => sum + order.items
      .filter((item) => item.cancelledAt === null)
      .reduce((lineSum, item) => lineSum + item.lineTotalCents, 0), 0)
    const tip = row.tip_accepted ? row.tip_amount_cents : 0
    const paid = payments.reduce((sum, payment) => sum
      + (payment.entry_type === 'received' ? payment.amount_applied_cents : -payment.amount_applied_cents), 0)
    const summary = tableAccountSummarySchema.parse({
      accountId: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      status: row.status,
      tipMode: row.tip_mode,
      tipPercentBps: row.tip_percent_bps,
      tipFixedCents: row.tip_fixed_cents,
      tipAccepted: row.tip_accepted,
      tipAmountCents: row.tip_amount_cents,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      subtotalCents: safeCents(subtotal),
      tipCents: safeCents(tip),
      totalCents: safeCents(subtotal + tip),
      paidCents: safeCents(paid),
      balanceDueCents: safeCents(Math.max(subtotal + tip - paid, 0)),
    })
    return {
      ...summary,
      openedBy: row.opened_by,
      closedBy: row.closed_by,
      tipDecidedAt: row.tip_decided_at,
      orders: accountOrders,
      payments: payments.map((payment) => ({
        id: payment.id,
        methodId: payment.method_id,
        methodName: payment.method_name,
        entryType: payment.entry_type as 'received' | 'refunded',
        amountAppliedCents: payment.amount_applied_cents,
        cashReceivedCents: payment.cash_received_cents,
        cashChangeCents: payment.cash_change_cents,
        reversesPaymentId: payment.reverses_payment_id,
        reference: payment.reference,
        reason: payment.reason,
        createdBy: payment.created_by,
        createdAt: payment.created_at,
      })),
      events: (eventsByAccount.get(row.id) ?? []).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        actorId: event.actor_id,
        reason: event.reason,
        details: objectDetails(event.details),
        createdAt: event.created_at,
      })),
    }
  })
}

async function summarizeAccounts(db: Db, rows: AccountSummaryRow[]): Promise<TableAccountSummaryDTO[]> {
  if (!rows.length) return []
  const accountIds = rows.map((row) => row.id)
  const [orders, payments] = await Promise.all([
    fetchAllRows(
      (from, to) => db.from('orders').select('id, table_account_id').in('table_account_id', accountIds)
        .order('id', { ascending: true }).range(from, to),
      'Não foi possível resumir os pedidos das comandas',
    ),
    fetchAllRows(
      (from, to) => db.from('table_account_payments').select('table_account_id, entry_type, amount_applied_cents')
        .in('table_account_id', accountIds).order('id', { ascending: true }).range(from, to),
      'Não foi possível resumir os recebimentos das comandas',
    ),
  ])

  const orderToAccount = new Map(orders.map((order) => [order.id, order.table_account_id]))
  const orderIds = [...orderToAccount.keys()]
  const orderIdBatches: string[][] = []
  for (let offset = 0; offset < orderIds.length; offset += 200) {
    orderIdBatches.push(orderIds.slice(offset, offset + 200))
  }
  const itemBatches = await Promise.all(orderIdBatches.map((batch) => fetchAllRows(
    (from, to) => db.from('order_items').select('order_id, line_total_cents, cancelled_at')
      .in('order_id', batch).order('order_id', { ascending: true }).order('id', { ascending: true }).range(from, to),
    'Não foi possível resumir os itens das comandas',
  )))
  const items = itemBatches.flat()

  const subtotalByAccount = new Map<string, number>()
  for (const item of items) {
    if (item.cancelled_at) continue
    const accountId = orderToAccount.get(item.order_id)
    if (!accountId) continue
    subtotalByAccount.set(accountId, (subtotalByAccount.get(accountId) ?? 0) + item.line_total_cents)
  }
  const paidByAccount = new Map<string, number>()
  for (const payment of payments) {
    const amount = payment.entry_type === 'received' ? payment.amount_applied_cents : -payment.amount_applied_cents
    paidByAccount.set(payment.table_account_id, (paidByAccount.get(payment.table_account_id) ?? 0) + amount)
  }

  return rows.map((row) => {
    const subtotal = safeCents(subtotalByAccount.get(row.id) ?? 0)
    const tip = row.tip_accepted ? safeCents(row.tip_amount_cents) : 0
    const paid = safeCents(paidByAccount.get(row.id) ?? 0)
    return tableAccountSummarySchema.parse({
      accountId: row.id,
      restaurantId: row.restaurant_id,
      tableNumber: row.table_number,
      status: row.status,
      tipMode: row.tip_mode,
      tipPercentBps: row.tip_percent_bps,
      tipFixedCents: row.tip_fixed_cents,
      tipAccepted: row.tip_accepted,
      tipAmountCents: row.tip_amount_cents,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      subtotalCents: subtotal,
      tipCents: tip,
      totalCents: safeCents(subtotal + tip),
      paidCents: paid,
      balanceDueCents: safeCents(Math.max(subtotal + tip - paid, 0)),
    })
  })
}

export async function getTableAccountForTable(input: { restaurantId: unknown; tableNumber: number }): Promise<TableAccountDTO | null> {
  const restaurantId = uuidSchema.parse(input.restaurantId)
  if (!Number.isInteger(input.tableNumber) || input.tableNumber < 1) throw new UserFacingError('Número de mesa inválido.')
  const role = await myRole(restaurantId)
  if (!role) throw new UserFacingError('Você não tem acesso a este restaurante.')
  const db = await getClient()
  const { data, error } = await db.from('table_accounts').select('*')
    .eq('restaurant_id', restaurantId).eq('table_number', input.tableNumber)
    .in('status', ['open', 'settling']).maybeSingle()
  if (error) throw new Error(`Não foi possível carregar a conta da mesa: ${error.message}`)
  if (!data) return null
  const accounts = await hydrateAccounts(db, [data])
  return accounts[0] ?? null
}

export async function getTableAccountDetails(input: { restaurantId: unknown; accountId: unknown }): Promise<TableAccountDTO | null> {
  const restaurantId = uuidSchema.parse(input.restaurantId)
  const accountId = uuidSchema.parse(input.accountId)
  const role = await myRole(restaurantId)
  if (!role) throw new UserFacingError('Você não tem acesso a este restaurante.')
  const db = await getClient()
  const { data, error } = await db.from('table_accounts').select('*')
    .eq('restaurant_id', restaurantId).eq('id', accountId).maybeSingle()
  if (error) throw new Error(`Não foi possível carregar a comanda: ${error.message}`)
  if (!data) return null
  const accounts = await hydrateAccounts(db, [data])
  return accounts[0] ?? null
}

export async function listCashAccounts(restaurantIdValue: unknown): Promise<{ active: TableAccountSummaryDTO[]; recentClosed: TableAccountSummaryDTO[] }> {
  const restaurantId = uuidSchema.parse(restaurantIdValue)
  ensureCashRole(await myRole(restaurantId))
  const db = await getClient()
  const [activeResult, closedResult] = await Promise.all([
    db.from('table_accounts').select('id, restaurant_id, table_number, status, tip_mode, tip_percent_bps, tip_fixed_cents, tip_accepted, tip_amount_cents, opened_at, closed_at').eq('restaurant_id', restaurantId)
      .in('status', ['open', 'settling']).order('opened_at', { ascending: true }).order('id', { ascending: true }),
    db.from('table_accounts').select('id, restaurant_id, table_number, status, tip_mode, tip_percent_bps, tip_fixed_cents, tip_accepted, tip_amount_cents, opened_at, closed_at').eq('restaurant_id', restaurantId)
      .eq('status', 'closed').order('closed_at', { ascending: false }).order('id', { ascending: false }).limit(25),
  ])
  if (activeResult.error) throw new Error(`Não foi possível listar as comandas: ${activeResult.error.message}`)
  if (closedResult.error) throw new Error(`Não foi possível listar as contas fechadas: ${closedResult.error.message}`)
  const [active, recentClosed] = await Promise.all([
    summarizeAccounts(db, (activeResult.data ?? []) as AccountSummaryRow[]),
    summarizeAccounts(db, (closedResult.data ?? []) as AccountSummaryRow[]),
  ])
  return { active, recentClosed }
}

export async function getCheckoutSettings(restaurantIdValue: unknown): Promise<CheckoutSettingsDTO> {
  const restaurantId = uuidSchema.parse(restaurantIdValue)
  const role = await myRole(restaurantId)
  ensureCashRole(role)
  const db = await getClient()
  const [settings, methods] = await Promise.all([
    db.from('restaurant_checkout_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
    db.from('restaurant_payment_methods').select('*').eq('restaurant_id', restaurantId).order('position'),
  ])
  if (settings.error || !settings.data) throw new Error('Não foi possível carregar as configurações do caixa.')
  if (methods.error) throw new Error(`Não foi possível carregar as formas de pagamento: ${methods.error.message}`)
  return {
    tipMode: settings.data.tip_mode as CheckoutSettingsDTO['tipMode'],
    tipPercentBps: settings.data.tip_percent_bps,
    tipFixedCents: settings.data.tip_fixed_cents,
    paymentMethods: (methods.data ?? []).flatMap((method): PaymentMethodDTO[] => {
      const type = paymentMethodTypeSchema.safeParse(method.method_type)
      return type.success ? [{ id: method.id, methodType: type.data, name: method.name, isActive: method.is_active, position: method.position }] : []
    }),
  }
}

export async function saveCheckoutSettings(input: unknown): Promise<void> {
  const data = checkoutSettingsInputSchema.parse(input)
  if (await myRole(data.restaurantId) !== 'admin') throw new UserFacingError('Somente a administração pode alterar as configurações do caixa.')
  const db = await getClient()
  const { error } = await db.from('restaurant_checkout_settings').update({
    tip_mode: data.tipMode,
    tip_percent_bps: data.tipPercentBps,
    tip_fixed_cents: data.tipFixedCents,
    updated_at: new Date().toISOString(),
  }).eq('restaurant_id', data.restaurantId)
  if (error) throw new Error(`Não foi possível salvar a política de gorjeta: ${error.message}`)
}

export async function createCustomPaymentMethod(input: unknown): Promise<void> {
  const data = savePaymentMethodSchema.parse(input)
  if (await myRole(data.restaurantId) !== 'admin') throw new UserFacingError('Somente a administração pode configurar formas de pagamento.')
  const db = await getClient()
  const { data: lastMethod, error: positionError } = await db.from('restaurant_payment_methods')
    .select('position').eq('restaurant_id', data.restaurantId).order('position', { ascending: false }).limit(1).maybeSingle()
  if (positionError) throw new Error(`Não foi possível posicionar a forma de pagamento: ${positionError.message}`)
  const { error } = await db.from('restaurant_payment_methods').insert({
    restaurant_id: data.restaurantId, method_type: 'custom', name: data.name,
    position: (lastMethod?.position ?? -1) + 1,
  })
  if (error) throw new UserFacingError('Não foi possível adicionar essa forma. Confira se ela já existe.')
}

export async function setPaymentMethodActive(input: unknown): Promise<void> {
  const data = setPaymentMethodActiveSchema.parse(input)
  if (await myRole(data.restaurantId) !== 'admin') throw new UserFacingError('Somente a administração pode configurar formas de pagamento.')
  const db = await getClient()
  const { error } = await db.rpc('set_restaurant_payment_method_active', {
    p_restaurant_id: data.restaurantId,
    p_method_id: data.methodId,
    p_is_active: data.isActive,
  })
  if (error?.message.includes('payment_method_last_active')) {
    throw new UserFacingError('Mantenha ao menos uma forma de pagamento ativa no restaurante.')
  }
  if (error?.message.includes('payment_method_not_found')) {
    throw new UserFacingError('Essa forma de pagamento não está mais disponível.')
  }
  if (error) throw new Error(`Não foi possível atualizar a forma de pagamento: ${error.message}`)
}

async function assertAccountScope(db: Db, restaurantId: string, accountId: string): Promise<void> {
  const { data, error } = await db.from('table_accounts').select('id')
    .eq('restaurant_id', restaurantId).eq('id', accountId).maybeSingle()
  if (error) throw new Error(`Não foi possível conferir a comanda: ${error.message}`)
  if (!data) throw new UserFacingError('A comanda não está disponível neste restaurante.')
}

function rpcError(error: { message: string }): never {
  const message = error.message
  const translations: [string, string][] = [
    ['account_not_found', 'A comanda não foi encontrada.'],
    ['account_closed', 'A comanda já foi encerrada.'],
    ['account_not_open', 'Esta comanda não aceita essa alteração.'],
    ['account_not_settling', 'Esta comanda não está em processo de fechamento.'],
    ['account_no_balance_due', 'Não há saldo pendente para receber.'],
    ['payment_exceeds_balance', 'O valor excede o saldo atual. Atualize a comanda.'],
    ['payment_method_unavailable', 'Essa forma de pagamento está inativa. Atualize a lista.'],
    ['cash_amount_invalid', 'Confira o valor recebido em dinheiro e o troco.'],
    ['account_total_too_large', 'O total desta comanda excede o limite permitido. Revise o pedido ou a política de gorjeta.'],
    ['tip_disabled', 'A gorjeta está desativada para esta comanda.'],
    ['reverse_post_decision_payments_first', 'Estorne os recebimentos posteriores à decisão da gorjeta antes de reabrir.'],
    ['refund_exceeds_payment', 'O estorno excede o valor líquido do recebimento original.'],
    ['refund_before_cancellation', 'Estorne valores suficientes antes de cancelar este item.'],
    ['order_item_already_cancelled', 'Este item já foi cancelado.'],
    ['duplicate_request', 'Outra alteração foi registrada com esta solicitação. Atualize a comanda.'],
    ['forbidden', 'Você não tem permissão para esta operação.'],
  ]
  const match = translations.find(([key]) => message.includes(key))
  if (match) throw new UserFacingError(match[1])
  throw new Error(`Não foi possível atualizar a comanda: ${message}`)
}

async function mutationResult(result: unknown, accountId: string): Promise<TableAccountDTO> {
  const summary = tableAccountSummarySchema.safeParse(result)
  if (!summary.success) throw new Error('O servidor retornou um resumo de comanda inválido.')
  const account = await getTableAccountDetails({ restaurantId: summary.data.restaurantId, accountId })
  if (!account) throw new Error('A comanda foi atualizada, mas não foi possível reler os detalhes.')
  return account
}

export async function recordAccountPayment(input: unknown): Promise<TableAccountDTO> {
  const data = recordTablePaymentSchema.parse(input)
  ensureCashRole(await myRole(data.restaurantId))
  const db = await getClient()
  await assertAccountScope(db, data.restaurantId, data.accountId)
  const { data: result, error } = await db.rpc('record_table_payment', {
    p_account_id: data.accountId,
    p_method_id: data.methodId,
    p_request_id: data.requestId,
    p_amount_applied_cents: data.amountAppliedCents,
    p_cash_received_cents: data.cashReceivedCents ?? null,
  })
  if (error) rpcError(error)
  return mutationResult(result, data.accountId)
}

export async function decideTipAndClose(input: unknown): Promise<TableAccountDTO> {
  const data = decideTipSchema.parse(input)
  ensureCashRole(await myRole(data.restaurantId))
  const db = await getClient()
  await assertAccountScope(db, data.restaurantId, data.accountId)
  const { data: result, error } = await db.rpc('decide_tip_and_close_table_account', {
    p_account_id: data.accountId, p_tip_accepted: data.tipAccepted, p_request_id: data.requestId,
  })
  if (error) rpcError(error)
  return mutationResult(result, data.accountId)
}

export async function reopenTableAccount(input: unknown): Promise<TableAccountDTO> {
  const data = reopenAccountSchema.parse(input)
  if (await myRole(data.restaurantId) !== 'admin') throw new UserFacingError('Somente a administração pode reabrir uma liquidação.')
  const db = await getClient()
  await assertAccountScope(db, data.restaurantId, data.accountId)
  const { data: result, error } = await db.rpc('reopen_table_account', {
    p_account_id: data.accountId, p_reason: data.reason, p_request_id: data.requestId,
  })
  if (error) rpcError(error)
  return mutationResult(result, data.accountId)
}

export async function reverseAccountPayment(input: unknown): Promise<TableAccountDTO> {
  const data = reversePaymentSchema.parse(input)
  ensureCashRole(await myRole(data.restaurantId))
  const db = await getClient()
  const { data: payment, error: paymentError } = await db.from('table_account_payments').select('id, table_account_id')
    .eq('restaurant_id', data.restaurantId).eq('id', data.paymentId).maybeSingle()
  if (paymentError) throw new Error(`Não foi possível conferir o recebimento: ${paymentError.message}`)
  if (!payment) throw new UserFacingError('O recebimento não está disponível neste restaurante.')
  const { data: result, error } = await db.rpc('reverse_table_account_payment', {
    p_payment_id: data.paymentId, p_amount_cents: data.amountCents,
    p_reason: data.reason, p_request_id: data.requestId,
  })
  if (error) rpcError(error)
  return mutationResult(result, payment.table_account_id)
}

export async function cancelAccountOrderItem(input: unknown): Promise<TableAccountDTO> {
  const data = cancelOrderItemSchema.parse(input)
  if (await myRole(data.restaurantId) !== 'admin') throw new UserFacingError('Somente a administração pode cancelar itens já registrados.')
  const db = await getClient()
  const { data: item, error: itemError } = await db.from('order_items').select('id, order_id')
    .eq('restaurant_id', data.restaurantId).eq('id', data.orderItemId).maybeSingle()
  if (itemError) throw new Error(`Não foi possível conferir o item: ${itemError.message}`)
  if (!item) throw new UserFacingError('O item não está disponível neste restaurante.')
  const { data: order, error: orderError } = await db.from('orders').select('table_account_id')
    .eq('restaurant_id', data.restaurantId).eq('id', item.order_id).maybeSingle()
  if (orderError || !order) throw new UserFacingError('O pedido não está disponível neste restaurante.')
  const { data: result, error } = await db.rpc('cancel_order_item', {
    p_order_item_id: data.orderItemId, p_reason: data.reason, p_request_id: data.requestId,
  })
  if (error) rpcError(error)
  return mutationResult(result, order.table_account_id)
}
