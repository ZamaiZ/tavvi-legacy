'use server'

import * as dal from '@/server/dal/profile'
import { revalidateLists } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function updateDisplayNameAction(
  input: unknown,
): Promise<ActionResult<{ displayName: string }>> {
  return runAction(async () => {
    const displayName = await dal.updateMyDisplayName(input)
    // O nome aparece na casca dos dois territórios e na equipe de cada
    // restaurante da pessoa: a varrida das listas cobre todos.
    revalidateLists()
    return { displayName }
  })
}
