import { z } from 'zod'
import { internalPathSchema, timestampSchema, uuidSchema } from './common'

export const NOTIFICATION_KINDS = ['feedback_received', 'team_member_joined', 'restaurant_joined', 'test'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export type NotificationTerritory = 'admin' | 'painel'

export type NotificationDTO = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Caminho no próprio território (/restaurantes/…). */
  url: string
  restaurantId: string | null
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type NotificationPage = { items: NotificationDTO[]; hasMore: boolean }

export type RealtimeSession = {
  token: string
  /** Segundos desde 1970, como o Supabase devolve. */
  expiresAt: number
  userId: string
  territory: NotificationTerritory
}

export const listNotificationsSchema = z.object({
  cursor: z.object({ createdAt: timestampSchema, id: uuidSchema }).optional(),
})

// O teste volta para a tela de onde saiu (caminho externo do território).
export const sendTestNotificationSchema = z.object({
  url: internalPathSchema,
})

function isKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && (NOTIFICATION_KINDS as readonly string[]).includes(value)
}

// A mesma leitura serve a linha do PostgREST e o registro que o Realtime
// transmite (os dois em snake_case). Forma inesperada vira nulo: um kind
// novo no banco antes do deploy não pode derrubar a central.
export function notificationFromRow(value: unknown): NotificationDTO | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.body !== 'string' ||
    typeof row.url !== 'string' ||
    typeof row.created_at !== 'string' ||
    !isKind(row.kind)
  ) {
    return null
  }
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url,
    restaurantId: typeof row.restaurant_id === 'string' ? row.restaurant_id : null,
    data: row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {},
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    createdAt: row.created_at,
  }
}

// realtime.broadcast_changes manda { payload: { record, old_record, … } }.
// Versões antigas do cliente entregam o payload direto; as duas formas são
// aceitas, como no NotificationsProvider do zamai.os.
export function readBroadcast(message: unknown): { record: NotificationDTO | null; old: NotificationDTO | null } {
  const root = message && typeof message === 'object' ? (message as Record<string, unknown>) : {}
  const payload =
    root.payload && typeof root.payload === 'object' ? (root.payload as Record<string, unknown>) : root
  return {
    record: notificationFromRow(payload.record ?? payload.new),
    old: notificationFromRow(payload.old_record ?? payload.old),
  }
}
