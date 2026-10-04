'use server'

import { after } from 'next/server'
import type { StartedFeedback } from '@/domain/feedback'
import * as dal from '@/server/dal/feedback-public'
import * as push from '@/server/dal/push'
import { runAction, type ActionResult } from './result'

export async function startFeedbackAction(input: unknown): Promise<ActionResult<StartedFeedback>> {
  return runAction(() => dal.beginFeedback(input))
}

export async function publishFeedbackAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    const { published } = await dal.publishFeedback(input)
    if (!published) return
    after(async () => {
      try {
        await push.deliverPendingPushes()
      } catch (error) {
        console.error('[push] aviso de feedback não enviado', error instanceof Error ? error.message : error)
      }
    })
  })
}
