'use server'

import type { FeedbackPage } from '@/domain/feedback'
import * as dal from '@/server/dal/feedback'
import { runAction, type ActionResult } from './result'

export async function listFeedbackAction(input: unknown): Promise<ActionResult<FeedbackPage>> {
  return runAction(() => dal.listFeedback(input))
}

// Ação rápida (fora de formulário): instantânea.
export async function markFeedbackReadAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.markFeedbackRead(input))
}

export async function deleteFeedbackAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.deleteFeedback(input))
}

// A tela chama ao montar e não espera. Fica numa ação, e não em after() na
// página, porque em Server Components o after() não pode ler cookies
// (after.md, "In Server Components"), e a limpeza precisa da sessão do admin.
export async function cleanupAbandonedFeedbackAction(restaurantId: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.cleanupAbandonedFeedback(restaurantId))
}
