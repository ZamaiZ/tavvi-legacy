import 'server-only'
import {
  pushEndpointSchema,
  pushSubscriptionChangeSchema,
  pushSubscriptionSchema,
  type PushSubscriptionInput,
} from '@/domain/push'
import type { PrivateTerritory } from '@/lib/route-paths'
import { env } from '@/server/env'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, getCurrentUser, UserFacingError } from './auth'

// Sem redirect, de propósito: o provedor chama estas funções também em
// /entrar e /convite, e redirecionar tiraria a pessoa da tela.
async function session(): Promise<{ territory: PrivateTerritory; userId: string }> {
  const territory = await currentTerritory()
  if (territory === 'site') throw new UserFacingError('Notificações só existem no painel e no console.')
  const user = await getCurrentUser()
  if (!user) throw new UserFacingError('Entre novamente para mexer nas notificações.')
  return { territory, userId: user.id }
}

// Função ou tabela de push ausente no banco é migração não aplicada. Dizer
// isso na tela poupa a caça no log: foi o que escondeu o 0024 faltando.
function failure(action: string, error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01') {
    return new UserFacingError(
      'As notificacoes ainda nao estao configuradas no banco. Recrie o schema Web com a migration baseline do Supabase.',
    )
  }
  return new Error(`${action}: ${error.message}`)
}

async function save(territory: PrivateTerritory, subscription: PushSubscriptionInput): Promise<void> {
  const supabase = await createUserClient(territory)
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
    p_territory: territory,
    p_expiration_time: subscription.expirationTime
      ? new Date(subscription.expirationTime).toISOString()
      : undefined,
  })
  if (error) throw failure('Não foi possível salvar o aparelho', error)
}

async function remove(territory: PrivateTerritory, endpoint: string): Promise<void> {
  const supabase = await createUserClient(territory)
  const { error } = await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })
  if (error) throw failure('Não foi possível remover o aparelho', error)
}

export async function savePushSubscription(input: unknown): Promise<void> {
  const { territory, userId } = await session()
  const subscription = pushSubscriptionSchema.parse(input)
  await enforceRateLimit('push:subscribe', `user:${userId}`)
  await save(territory, subscription)
}

// pushsubscriptionchange: o navegador trocou a inscrição sozinho.
export async function replacePushSubscription(input: unknown): Promise<void> {
  const { territory, userId } = await session()
  const { oldEndpoint, subscription } = pushSubscriptionChangeSchema.parse(input)
  await enforceRateLimit('push:subscribe', `user:${userId}`)
  if (oldEndpoint && oldEndpoint !== subscription.endpoint) await remove(territory, oldEndpoint)
  await save(territory, subscription)
}

export async function deletePushSubscription(input: unknown): Promise<void> {
  const { territory } = await session()
  await remove(territory, pushEndpointSchema.parse(input))
}

// Express claims pending notifications and sends them through browser Web Push.
export async function deliverPendingPushes(): Promise<void> {
  try {
    const response = await fetch(`${env.API_BASE_URL.replace(/\/$/, '')}/api/v1/internal/push/deliver`, {
      method: 'POST',
      headers: { 'x-server-key': env.APP_SERVER_KEY },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (!response.ok) console.error('[push] a API recusou a entrega', response.status)
  } catch (error) {
    console.error('[push] a API não respondeu', error instanceof Error ? error.message : error)
  }
}
