import { z } from 'zod'

// Os mesmos tipos do disparador (supabase/migrations/0029, 0032 e 0034). Um tipo
// novo no banco antes do deploy é descartado na leitura, nunca derruba a
// central.
export const NOTIFICATION_KINDS = ['feedback_received', 'team_member_joined', 'restaurant_joined', 'service_call_received', 'test'] as const
export const notificationKindSchema = z.enum(NOTIFICATION_KINDS)

// Data como o PostgREST devolve (timestamptz, até microssegundos).
const timestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/)

export const notificationCursorSchema = z.object({
  createdAt: timestampSchema,
  id: z.string().uuid(),
})

export const pushPlatformSchema = z.enum(['ios', 'android'])
export const expoPushTokenSchema = z.string().regex(/^Expo(nent)?PushToken\[[^\]]{10,200}\]$/)

export const registerDeviceSchema = z.object({
  token: expoPushTokenSchema,
  platform: pushPlatformSchema,
})

export const notificationActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  doneLabel: z.string().optional(),
  style: z.enum(['default', 'primary', 'destructive']).optional(),
  kind: z.enum(['navigate', 'mutation']),
  url: z.string().optional(),
})
export type NotificationAction = z.infer<typeof notificationActionSchema>

export type NotificationKind = z.infer<typeof notificationKindSchema>
export type NotificationCursor = z.infer<typeof notificationCursorSchema>
export type PushPlatform = z.infer<typeof pushPlatformSchema>
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Caminho no console web (/restaurantes/…); o app navega por kind. */
  url: string
  restaurantId: string | null
  createdAt: string
  actions?: NotificationAction[]
}

export type NotificationPage = { items: AppNotification[]; hasMore: boolean }
export type NotificationCount = { unread: number }
