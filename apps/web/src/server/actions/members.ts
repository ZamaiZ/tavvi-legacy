'use server'

import * as dal from '@/server/dal/members'
import { revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function removeMemberAction(
  membershipId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.removeMember(membershipId))
  })
}

export async function changeMemberRoleAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    revalidateRestaurant(await dal.changeMemberRole(input))
  })
}
