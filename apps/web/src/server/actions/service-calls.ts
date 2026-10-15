'use server'

import { after } from 'next/server'
import type {
  ClaimServiceCallOutcome,
  ResolveServiceCallOutcome,
  ServiceCallEventDTO,
  ServiceCallMutationResult,
  ServiceCallPage,
  ServiceCallRequest,
  ServiceCallTeamMemberDTO,
  ServiceCallDTO,
  TransferServiceCallOutcome,
} from '@/domain/service-call'
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
        catch (error) { console.error('[push] service call delivery failed', error instanceof Error ? error.message : error) }
      })
    }
    return result
  })
}

export async function listServiceCallsAction(input: unknown): Promise<ActionResult<ServiceCallPage>> {
  return runAction(() => dal.listServiceCalls(input))
}

export async function listServiceCallEventsAction(input: unknown): Promise<ActionResult<ServiceCallEventDTO[]>> {
  return runAction(() => dal.listServiceCallEvents(input))
}

export async function listServiceCallTeamAction(input: unknown): Promise<ActionResult<ServiceCallTeamMemberDTO[]>> {
  return runAction(() => dal.listServiceCallTeam(input))
}

export async function getServiceCallAction(input: unknown): Promise<ActionResult<ServiceCallDTO | null>> {
  return runAction(() => dal.getServiceCall(input))
}

export async function countPendingServiceCallsAction(input: unknown): Promise<ActionResult<number>> {
  return runAction(() => dal.countPendingServiceCalls(input))
}

export async function claimServiceCallAction(
  input: unknown,
): Promise<ActionResult<ServiceCallMutationResult<ClaimServiceCallOutcome>>> {
  return runAction(() => dal.claimServiceCall(input))
}

export async function transferServiceCallAction(
  input: unknown,
): Promise<ActionResult<ServiceCallMutationResult<TransferServiceCallOutcome>>> {
  return runAction(() => dal.transferServiceCall(input))
}

export async function resolveServiceCallAction(
  input: unknown,
): Promise<ActionResult<ServiceCallMutationResult<ResolveServiceCallOutcome>>> {
  return runAction(() => dal.resolveServiceCall(input))
}
