'use server'

import { after } from 'next/server'
import type { ServiceCallDTO, ServiceCallPage, ServiceCallRequest } from '@/domain/service-call'
import * as dal from '@/server/dal/service-calls'
import * as publicDal from '@/server/dal/service-calls-public'
import * as push from '@/server/dal/push'
import { runAction, type ActionResult } from './result'

export async function requestServiceCallAction(input: unknown): Promise<ActionResult<ServiceCallRequest>> {
  return runAction(async () => {
    const result = await publicDal.requestServiceCall(input)
    if (result.created) {
      after(async () => {
        try { await push.deliverPendingPushes() }
        catch (error) { console.error('[push] chamado não enviado', error instanceof Error ? error.message : error) }
      })
    }
    return result
  })
}

export async function listServiceCallsAction(input: unknown): Promise<ActionResult<ServiceCallPage>> {
  return runAction(() => dal.listServiceCalls(input))
}

export async function countPendingServiceCallsAction(input: unknown): Promise<ActionResult<number>> {
  return runAction(() => dal.countPendingServiceCalls(input))
}

export async function resolveServiceCallAction(input: unknown): Promise<ActionResult<ServiceCallDTO>> {
  return runAction(() => dal.resolveServiceCall(input))
}
