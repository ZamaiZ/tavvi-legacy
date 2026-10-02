import { notificationKindSchema, type AppNotification, type NotificationCount, type NotificationCursor, type NotificationPage } from '@tavvi/api-contracts'
import { HttpError } from '../../http/errors.js'
import type { AdminContext } from '../../http/request-context.js'
import { enforceAdminMutationRateLimit, enforceRateLimit } from '../../http/security.js'
import { scheduleDelivery } from '../push/push.service.js'
import { expoPushTokenSchema, notificationIdSchema, registerDeviceSchema } from './notification.schemas.js'

const PAGE_SIZE = 20
const COLUMNS = 'id,kind,title,body,url,restaurant_id,created_at'
// O app é o console: lê e registra só o território admin. A RLS garante a
// pessoa; o território mantém os avisos do painel fora daqui.
const TERRITORY = 'admin'

type DbError = { code?: string; message: string }

// Função ou tabela ausente é migração não aplicada: a tela diz qual. O resto
// vai para o log com o código, e a pessoa recebe a mensagem da operação.
function failure(error: DbError, code: string, message: string, migration: string): HttpError {
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01') {
    return new HttpError(503, 'NOTIFICATIONS_NOT_CONFIGURED', `As notificações ainda não estão configuradas no banco: falta aplicar a migração ${migration} no Supabase.`)
  }
  console.error('[notificações]', code, error.code ?? null, error.message)
  return new HttpError(500, code, message)
}

type Row = { id: string; kind: string; title: string; body: string; url: string; restaurant_id: string | null; created_at: string }

function toNotification(row: Row): AppNotification | null {
  const kind = notificationKindSchema.safeParse(row.kind)
  if (!kind.success) return null
  return { id: row.id, kind: kind.data, title: row.title, body: row.body, url: row.url, restaurantId: row.restaurant_id, createdAt: row.created_at }
}

export async function listUnread(context: AdminContext, cursor: NotificationCursor | null): Promise<NotificationPage> {
  let query = context.supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', context.user.id)
    .eq('territory', TERRITORY)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)
  // Os dois valores já passaram pelo notificationCursorSchema: nada além de
  // uma data e um uuid chega ao filtro.
  if (cursor) {
    query = query.or(`created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`)
  }
  const { data, error } = await query
  if (error) throw failure(error, 'NOTIFICATIONS_READ_FAILED', 'Não foi possível carregar as notificações.', '0029_notifications.sql')
  const items = (data ?? []).map(toNotification).filter((item): item is AppNotification => item !== null)
  return { items: items.slice(0, PAGE_SIZE), hasMore: items.length > PAGE_SIZE }
}

export async function countUnread(context: AdminContext): Promise<NotificationCount> {
  const { count, error } = await context.supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', context.user.id)
    .eq('territory', TERRITORY)
    .is('read_at', null)
  if (error) throw failure(error, 'NOTIFICATIONS_COUNT_FAILED', 'Não foi possível contar as notificações.', '0029_notifications.sql')
  return { unread: count ?? 0 }
}

export async function markRead(context: AdminContext, rawId: string) {
  const id = notificationIdSchema.parse(rawId)
  await enforceAdminMutationRateLimit(context)
  const { error } = await context.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', context.user.id)
    .eq('territory', TERRITORY)
    .is('read_at', null)
  if (error) throw failure(error, 'NOTIFICATION_READ_FAILED', 'Não foi possível marcar a notificação como lida.', '0029_notifications.sql')
  return { read: true as const }
}

export async function markAllRead(context: AdminContext) {
  await enforceAdminMutationRateLimit(context)
  const { error } = await context.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', context.user.id)
    .eq('territory', TERRITORY)
    .is('read_at', null)
  if (error) throw failure(error, 'NOTIFICATIONS_READ_ALL_FAILED', 'Não foi possível marcar todas como lidas.', '0029_notifications.sql')
  return { read: true as const }
}

// Uma notificação de verdade, pelo disparador, só para quem pediu: entra na
// central (web e app) e vira push em cada aparelho ativado.
export async function sendTest(context: AdminContext) {
  await enforceRateLimit(context.supabase, 'notifications:test', context.user.id)
  const { error } = await context.supabase.rpc('send_test_notification', { p_territory: TERRITORY, p_url: '/restaurantes' })
  if (error) throw failure(error, 'NOTIFICATION_TEST_FAILED', 'Não foi possível enviar a notificação de teste.', '0032_test_notification.sql')
  scheduleDelivery()
  return { sent: true as const }
}

export async function registerDevice(context: AdminContext, input: unknown) {
  const device = registerDeviceSchema.parse(input)
  await enforceRateLimit(context.supabase, 'notifications:devices', context.user.id)
  const { error } = await context.supabase.rpc('save_mobile_push_token', { p_token: device.token, p_platform: device.platform, p_territory: TERRITORY })
  if (error) throw failure(error, 'DEVICE_REGISTER_FAILED', 'Não foi possível ativar as notificações neste aparelho.', '0033_mobile_push.sql')
  return { registered: true as const }
}

export async function unregisterDevice(context: AdminContext, rawToken: string) {
  const token = expoPushTokenSchema.parse(rawToken)
  await enforceRateLimit(context.supabase, 'notifications:devices', context.user.id)
  const { error } = await context.supabase.rpc('delete_mobile_push_token', { p_token: token })
  if (error) throw failure(error, 'DEVICE_UNREGISTER_FAILED', 'Não foi possível desativar as notificações neste aparelho.', '0033_mobile_push.sql')
  return { removed: true as const }
}
