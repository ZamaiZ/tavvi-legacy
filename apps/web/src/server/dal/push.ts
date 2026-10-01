import 'server-only'
import type { Database } from '@/domain/database.types'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import {
  pushEndpointSchema,
  pushSubscriptionChangeSchema,
  pushSubscriptionSchema,
  type PushMessage,
  type PushSubscriptionInput,
} from '@/domain/push'
import { pwaAppName } from '@/lib/pwa'
import type { PrivateTerritory } from '@/lib/route-paths'
import { sendWebPush, type PushDelivery } from '@/server/push/web-push'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, getCurrentUser, UserFacingError } from './auth'

type ClaimRow = Database['public']['Functions']['claim_push_deliveries']['Returns'][number]

// Sem redirect, de propósito: o provedor chama estas funções também em
// /entrar e /convite, e redirecionar tiraria a pessoa da tela.
async function session(): Promise<{ territory: PrivateTerritory; userId: string }> {
  const territory = await currentTerritory()
  if (territory === 'site') throw new UserFacingError('Notificações só existem no painel e no console.')
  const user = await getCurrentUser()
  if (!user) throw new UserFacingError('Entre novamente para mexer nas notificações.')
  return { territory, userId: user.id }
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
  if (error) throw new Error(`Não foi possível salvar o aparelho: ${error.message}`)
}

async function remove(territory: PrivateTerritory, endpoint: string): Promise<void> {
  const supabase = await createUserClient(territory)
  const { error } = await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })
  if (error) throw new Error(`Não foi possível remover o aparelho: ${error.message}`)
}

// Aparelhos que o serviço de push deu como mortos. Falhar aqui não
// atrapalha ninguém: o próximo envio tenta de novo.
async function prune(territory: PrivateTerritory, endpoints: string[]): Promise<void> {
  if (!endpoints.length) return
  const supabase = await createUserClient(territory)
  const { error } = await supabase.rpc('prune_push_subscriptions', { p_endpoints: endpoints })
  if (error) console.error('[push] poda falhou', error.message)
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

export async function sendTestPush(): Promise<{ delivered: number }> {
  const { territory, userId } = await session()
  await enforceRateLimit('push:test', `user:${userId}`)

  const supabase = await createUserClient(territory)
  const { data, error } = await supabase.rpc('my_push_subscriptions', { p_territory: territory })
  if (error) throw new Error(`Não foi possível ler os aparelhos: ${error.message}`)
  if (!data?.length) throw new UserFacingError('Nenhum aparelho com notificações ativas.')

  const { delivered, gone } = await sendWebPush({
    targets: data,
    message: {
      title: 'Notificações ativas',
      body: `Este aparelho vai receber os avisos do ${pwaAppName(territory)}.`,
      url: '/',
      tag: 'tavvi-push-test',
    },
  })
  await prune(territory, gone)
  if (!delivered) throw new UserFacingError('O serviço de notificações não respondeu. Tente de novo.')
  return { delivered }
}

function messageFor(row: ClaimRow): PushMessage {
  if (row.kind === 'restaurant_joined') {
    return {
      title: 'Novo restaurante na Tavvi',
      body: `${row.restaurant_name} aceitou o convite (${row.actor_email}).`,
      url: `/restaurantes/${row.restaurant_id}`,
      tag: row.event_id,
    }
  }
  const role = MEMBER_ROLE_LABELS[row.member_role]?.toLocaleLowerCase('pt-BR') ?? 'membro'
  return {
    title: `Novo membro em ${row.restaurant_name}`,
    body: `${row.actor_email} entrou na equipe como ${role}.`,
    url: `/restaurantes/${row.restaurant_id}/equipe`,
    tag: row.event_id,
  }
}

// Depois de um resgate de convite. O gatilho do banco gravou o evento na
// mesma transação; quem resgatou o reivindica aqui, uma vez só.
export async function claimPushDeliveries(): Promise<PushDelivery[]> {
  const territory = await currentTerritory()
  if (territory === 'site') return []
  const supabase = await createUserClient(territory)
  const { data, error } = await supabase.rpc('claim_push_deliveries')
  if (error) {
    console.error('[push] reivindicação falhou', error.message)
    return []
  }

  const byEvent = new Map<string, PushDelivery>()
  for (const row of data ?? []) {
    const delivery = byEvent.get(row.event_id) ?? { message: messageFor(row), targets: [] }
    delivery.targets.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })
    byEvent.set(row.event_id, delivery)
  }
  return [...byEvent.values()]
}

export async function deliverPush(deliveries: PushDelivery[]): Promise<void> {
  if (!deliveries.length) return
  const results = await Promise.all(deliveries.map((delivery) => sendWebPush(delivery)))
  const territory = await currentTerritory()
  if (territory !== 'site') await prune(territory, results.flatMap((result) => result.gone))
}
