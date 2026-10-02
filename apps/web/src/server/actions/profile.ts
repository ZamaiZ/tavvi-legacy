'use server'

import * as dal from '@/server/dal/profile'
import { runAction, type ActionResult } from './result'

export async function changePasswordAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.changeMyPassword(input))
}
