import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  listNotificationsSchema,
  notificationFromRow,
  sendTestNotificationSchema,
  type NotificationDTO,
  type NotificationPage,
  type NotificationTerritory,
  type RealtimeSession,
} from '@/domain/notification'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, requireUser, UserFacingError } from './auth'

const PAGE_SIZE = 20
const COLUMNS = 'id, kind, title, body, url, restaurant_id, data, read_at, created_at'

// Toda consulta filtra por pessoa E por território. A RLS garante só a
// pessoa; o território é o que mantém o aviso do console fora do painel
// quando a mesma conta usa os dois.
async function context() {
  const territory = await currentTerritory()
  if (territory === 'site') throw new UserFacingError('Notificações só existem no painel e no console.')
  const user = await requireUser()
  return { territory: territory as NotificationTerritory, user, supabase: await createUserClient(territory) }
}

export async function listUnreadNotifications(input: unknown): Promise<NotificationPage> {
  const { cursor } = listNotificationsSchema.parse(input ?? {})
  const { territory, user, supabase } = await context()

  let query = supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', user.id)
    .eq('territory', territory)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)
  // Os dois valores já passaram por timestampSchema e uuidSchema: nada
  // além de uma data e um uuid chega ao filtro.
  if (cursor) {
    query = query.or(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw new Error(`Não foi possível ler as notificações: ${error.message}`)
  const items = (data ?? [])
    .map(notificationFromRow)
    .filter((item): item is NotificationDTO => item !== null)
  return { items: items.slice(0, PAGE_SIZE), hasMore: items.length > PAGE_SIZE }
}

export async function countUnreadNotifications(): Promise<number> {
  const { territory, user, supabase } = await context()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('territory', territory)
    .is('read_at', null)
  if (error) throw new Error(`Não foi possível contar as notificações: ${error.message}`)
  return count ?? 0
}

// Para as cascas (layout do console e do restaurante): um contador que não
// carrega não pode derrubar a navegação inteira.
export async function countUnreadNotificationsSafe(): Promise<number> {
  try {
    return await countUnreadNotifications()
  } catch (error) {
    console.error('[notificações] contagem da casca', error instanceof Error ? error.message : error)
    return 0
  }
}

export async function markNotificationRead(id: unknown): Promise<void> {
  const notificationId = uuidSchema.parse(id)
  const { territory, user, supabase } = await context()
  await enforceRateLimit('mutation', `user:${user.id}`)
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('territory', territory)
    .is('read_at', null)
  if (error) throw new Error(`Não foi possível marcar como lida: ${error.message}`)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { territory, user, supabase } = await context()
  await enforceRateLimit('mutation', `user:${user.id}`)
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('territory', territory)
    .is('read_at', null)
  if (error) throw new Error(`Não foi possível marcar todas como lidas: ${error.message}`)
}

// Uma notificação de verdade, pelo disparador, só para quem pediu: chega ao
// vivo, entra na central e vira push (a ação chama deliverPendingPushes).
export async function sendTestNotification(input: unknown): Promise<void> {
  const { url } = sendTestNotificationSchema.parse(input)
  const { territory, user, supabase } = await context()
  await enforceRateLimit('push:test', `user:${user.id}`)
  const { error } = await supabase.rpc('send_test_notification', { p_territory: territory, p_url: url })
  if (error) {
    if (error.code === 'PGRST202') {
      throw new UserFacingError('O teste ainda não está configurado no banco: falta aplicar a migração 0032_test_notification.sql no Supabase.')
    }
    throw new Error(`Não foi possível enviar o teste: ${error.message}`)
  }
}

// O token do Realtime sai do cookie do território, já renovado pelo proxy.
// O navegador nunca renova a sessão sozinho: renovar em dois lugares é o que
// queima o refresh token. Os cookies de sessão já são legíveis por
// JavaScript (@supabase/ssr sem httpOnly), então entregar o token aqui não
// expõe nada novo.
export async function realtimeSession(): Promise<RealtimeSession> {
  const { territory, user, supabase } = await context()
  await enforceRateLimit('realtime:token', `user:${user.id}`)
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new UserFacingError('Sua sessão expirou. Entre novamente.')
  return {
    token: data.session.access_token,
    expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 300,
    userId: user.id,
    territory,
  }
}
