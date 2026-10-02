import { z } from 'zod'
import { expoPushTokenSchema, notificationCursorSchema, registerDeviceSchema, type NotificationCursor } from '@tavvi/api-contracts'

export const notificationIdSchema = z.string().uuid()
export { expoPushTokenSchema, registerDeviceSchema }

// O cursor vem na query (?createdAt=&id=): os dois juntos ou nenhum.
export function parseCursor(query: Record<string, unknown>): NotificationCursor | null {
  const createdAt = typeof query.createdAt === 'string' ? query.createdAt : undefined
  const id = typeof query.id === 'string' ? query.id : undefined
  if (createdAt === undefined && id === undefined) return null
  return notificationCursorSchema.parse({ createdAt, id })
}
