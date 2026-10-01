'use server'

import * as dal from '@/server/dal/push'
import { runAction, type ActionResult } from './result'

// Chamadas pelo PushProvider (src/components/pwa/push-provider.tsx). A
// autorização e a validação ficam na DAL.

export async function savePushSubscriptionAction(subscription: unknown): Promise<ActionResult> {
  return runAction(() => dal.savePushSubscription(subscription))
}

export async function deletePushSubscriptionAction(endpoint: unknown): Promise<ActionResult> {
  return runAction(() => dal.deletePushSubscription(endpoint))
}

export async function sendTestPushAction(): Promise<ActionResult<{ delivered: number }>> {
  return runAction(() => dal.sendTestPush())
}
