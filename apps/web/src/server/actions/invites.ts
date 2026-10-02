'use server'

import { after } from 'next/server'
import * as dal from '@/server/dal/invites'
import * as push from '@/server/dal/push'
import { revalidateLists, revalidateRestaurant } from '@/server/revalidate'
import { runAction, type ActionResult } from './result'

export async function createPlatformInviteAction(
  input: unknown,
): Promise<ActionResult<{ id: string; link: string }>> {
  return runAction(async () => {
    // A autorização acontece DENTRO da DAL. Não basta a página ter
    // verificado: a action é um endpoint POST público por construção e pode
    // ser chamada direto, sem passar por tela nenhuma.
    const invite = await dal.createPlatformInvite(input)
    // Convite de plataforma não tem restaurante: só a lista do console muda.
    revalidateLists()
    // O link volta UMA vez. Quem chamar precisa mostrar agora; nem o banco
    // nem esta action conseguem produzi-lo de novo.
    return invite
  })
}

export async function rotatePlatformInviteAction(
  inviteId: unknown,
): Promise<ActionResult<{ id: string; link: string }>> {
  return runAction(async () => {
    const invite = await dal.rotatePlatformInvite(inviteId)
    revalidateLists()
    return invite
  })
}

export async function createTeamInviteAction(
  input: unknown,
): Promise<ActionResult<{ id: string; link: string }>> {
  return runAction(async () => {
    const { revalidationTarget, ...invite } = await dal.createTeamInvite(input)
    revalidateRestaurant(revalidationTarget)
    return invite
  })
}

export async function revokeInviteAction(
  inviteId: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    const revalidationTarget = await dal.revokeInvite(inviteId)
    // Nulo é convite de plataforma, que não pertence a restaurante nenhum.
    if (revalidationTarget) revalidateRestaurant(revalidationTarget)
    else revalidateLists()
  })
}

export async function redeemInviteAction(
  token: unknown,
): Promise<ActionResult<{ restaurantId: string }>> {
  return runAction(async () => {
    const revalidationTarget = await dal.redeemInvite(token)
    revalidateRestaurant(revalidationTarget)
    // Quem resgatou passou a enxergar um restaurante que antes não aparecia
    // na lista dele.
    revalidateLists()
    notifyAfterRedeem()
    return { restaurantId: revalidationTarget.id }
  })
}

export async function redeemPlatformInviteAction(
  input: unknown,
): Promise<ActionResult<{ restaurantId: string }>> {
  return runAction(async () => {
    const revalidationTarget = await dal.redeemPlatformInvite(input)
    revalidateRestaurant(revalidationTarget)
    // Este resgate CRIA um restaurante. As duas listas mudam.
    revalidateLists()
    notifyAfterRedeem()
    return { restaurantId: revalidationTarget.id }
  })
}

// O banco gravou o aviso na transação do resgate (memberships_notify →
// dispatch_notification). O envio fica para depois da resposta, e falhar
// nele nunca desfaz o resgate.
function notifyAfterRedeem() {
  after(async () => {
    try {
      await push.deliverPendingPushes()
    } catch (error) {
      console.error('[push] aviso de convite não enviado', error instanceof Error ? error.message : error)
    }
  })
}
