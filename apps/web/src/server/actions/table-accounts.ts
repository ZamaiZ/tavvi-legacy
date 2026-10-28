'use server'

import type { CheckoutSettingsDTO, TableAccountDTO, TableAccountSummaryDTO } from '@/domain/table-account'
import * as dal from '@/server/dal/table-accounts'
import { runAction, type ActionResult } from './result'

export async function getTableAccountForTableAction(input: { restaurantId: string; tableNumber: number }): Promise<ActionResult<TableAccountDTO | null>> {
  return runAction(() => dal.getTableAccountForTable(input))
}

export async function listCashAccountsAction(restaurantId: string): Promise<ActionResult<{ active: TableAccountSummaryDTO[]; recentClosed: TableAccountSummaryDTO[] }>> {
  return runAction(() => dal.listCashAccounts(restaurantId))
}

export async function listPendingCashAccountsAction(restaurantId: string): Promise<ActionResult<TableAccountSummaryDTO[]>> {
  return runAction(() => dal.listPendingCashAccounts(restaurantId))
}

export async function getTableAccountDetailsAction(input: { restaurantId: string; accountId: string }): Promise<ActionResult<TableAccountDTO | null>> {
  return runAction(() => dal.getTableAccountDetails(input))
}

export async function getCheckoutSettingsAction(restaurantId: string): Promise<ActionResult<CheckoutSettingsDTO>> {
  return runAction(() => dal.getCheckoutSettings(restaurantId))
}

export async function saveCheckoutSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(() => dal.saveCheckoutSettings(input))
}

export async function createCustomPaymentMethodAction(input: unknown): Promise<ActionResult> {
  return runAction(() => dal.createCustomPaymentMethod(input))
}

export async function setPaymentMethodActiveAction(input: unknown): Promise<ActionResult> {
  return runAction(() => dal.setPaymentMethodActive(input))
}

export async function recordAccountPaymentAction(input: unknown): Promise<ActionResult<TableAccountDTO>> {
  return runAction(() => dal.recordAccountPayment(input))
}

export async function decideTipAndCloseAction(input: unknown): Promise<ActionResult<TableAccountDTO>> {
  return runAction(() => dal.decideTipAndClose(input))
}

export async function reopenTableAccountAction(input: unknown): Promise<ActionResult<TableAccountDTO>> {
  return runAction(() => dal.reopenTableAccount(input))
}

export async function reverseAccountPaymentAction(input: unknown): Promise<ActionResult<TableAccountDTO>> {
  return runAction(() => dal.reverseAccountPayment(input))
}

export async function cancelAccountOrderItemAction(input: unknown): Promise<ActionResult<TableAccountDTO>> {
  return runAction(() => dal.cancelAccountOrderItem(input))
}
