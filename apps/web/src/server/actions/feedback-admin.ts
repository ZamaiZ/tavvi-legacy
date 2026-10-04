'use server'

import type { FeedbackPage } from '@/domain/feedback'
import * as dal from '@/server/dal/feedback'
import { runAction, type ActionResult } from './result'

export async function listFeedbackAction(input: unknown): Promise<ActionResult<FeedbackPage>> {
  return runAction(() => dal.listFeedback(input))
}

export async function markFeedbackReadAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.markFeedbackRead(input))
}

export async function deleteFeedbackAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.deleteFeedback(input))
}

export async function cleanupAbandonedFeedbackAction(restaurantId: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.cleanupAbandonedFeedback(restaurantId))
}
