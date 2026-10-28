'use server'

import type { CashDayDetailDTO, CashDayHistoryPageDTO, FinanceDashboardDTO, LegacyFinanceReportDTO } from '@/domain/finance'
import * as dal from '@/server/dal/finance'
import { runAction, type ActionResult } from './result'

export async function getFinanceDashboardAction(input: unknown): Promise<ActionResult<FinanceDashboardDTO>> {
  return runAction(() => dal.getFinanceDashboard(input))
}

export async function getLegacyFinanceReportAction(input: unknown): Promise<ActionResult<LegacyFinanceReportDTO>> {
  return runAction(() => dal.getLegacyFinanceReport(input))
}

export async function getCashDayDetailsAction(input: unknown): Promise<ActionResult<CashDayDetailDTO | null>> {
  return runAction(() => dal.getCashDayDetails(input as { restaurantId: unknown; cashDayId: unknown }))
}

export async function getCashDayHistoryPageAction(input: unknown): Promise<ActionResult<CashDayHistoryPageDTO>> {
  return runAction(() => dal.getCashDayHistoryPage(input))
}

export async function openCashDayAction(input: unknown): Promise<ActionResult<FinanceDashboardDTO>> {
  return runAction(() => dal.openCashDay(input))
}

export async function recordCashDayMovementAction(input: unknown): Promise<ActionResult<FinanceDashboardDTO>> {
  return runAction(() => dal.recordCashDayMovement(input))
}

export async function closeCashDayAction(input: unknown): Promise<ActionResult<FinanceDashboardDTO>> {
  return runAction(() => dal.closeCashDay(input))
}
