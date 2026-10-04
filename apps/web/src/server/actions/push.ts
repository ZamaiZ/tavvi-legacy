'use server'

import * as dal from '@/server/dal/push'
import { runAction, type ActionResult } from './result'

export async function savePushSubscriptionAction(subscription: unknown): Promise<ActionResult> {
  return runAction(() => dal.savePushSubscription(subscription))
}

export async function deletePushSubscriptionAction(endpoint: unknown): Promise<ActionResult> {
  return runAction(() => dal.deletePushSubscription(endpoint))
}
