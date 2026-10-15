'use server'

import type { RecordTableOrderResult } from '@/domain/orders'
import * as dal from '@/server/dal/orders'
import { runAction, type ActionResult } from './result'

export async function recordTableOrderAction(input: unknown): Promise<ActionResult<RecordTableOrderResult>> {
  return runAction(() => dal.recordTableOrder(input))
}
