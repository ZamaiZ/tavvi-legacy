'use server'

import { after } from 'next/server'
import type { NotificationPage, RealtimeSession } from '@/domain/notification'
import * as dal from '@/server/dal/notifications'
import * as push from '@/server/dal/push'
import { runAction, type ActionResult } from './result'

export async function listUnreadNotificationsAction(input: unknown): Promise<ActionResult<NotificationPage>> {
  return runAction(() => dal.listUnreadNotifications(input))
}

export async function countUnreadNotificationsAction(): Promise<ActionResult<number>> {
  return runAction(() => dal.countUnreadNotifications())
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult<void>> {
  return runAction(() => dal.markNotificationRead(id))
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<void>> {
  return runAction(() => dal.markAllNotificationsRead())
}

export async function getRealtimeTokenAction(): Promise<ActionResult<RealtimeSession>> {
  return runAction(() => dal.realtimeSession())
}

export async function sendTestNotificationAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    await dal.sendTestNotification(input)
    after(async () => {
      try {
        await push.deliverPendingPushes()
      } catch (error) {
        console.error('[push] teste não enviado', error instanceof Error ? error.message : error)
      }
    })
  })
}
