import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { pushSupported, syncThisDevice } from './push'
import { markNotificationRead, notificationKeys, useUnreadCount } from './queries'

// Com o app aberto, o sistema só mostra o aviso se houver handler. O número
// no ícone é nosso (setBadgeCountAsync, igual à central), não do push.
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

// Destino de uma notificação no app: o restaurante quando há um, senão a
// central. A url é do console web; aqui vale o kind.
export function openNotificationTarget(kind: string | null, restaurantId: string | null) {
  if (kind === 'restaurant_joined' && restaurantId) router.push({ pathname: '/restaurants/[id]', params: { id: restaurantId } })
  else router.push('/notifications')
}

function readData(response: Notifications.NotificationResponse) {
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' && value ? value : null)
  return { notificationId: text(data.notificationId), kind: text(data.kind), restaurantId: text(data.restaurantId) }
}

// Montado só com sessão, em (app)/_layout.tsx: banner com o app aberto,
// toque no push (também com o app fechado), token trocado pelo sistema e
// contador no ícone.
export function NotificationRuntime() {
  const queryClient = useQueryClient()
  const unread = useUnreadCount()
  const handled = useRef(new Set<string>())
  const count = unread.data ?? 0

  useEffect(() => {
    if (!pushSupported) return
    const refreshInbox = () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox })

    // O toque que abriu o app chega por getLastNotificationResponse e pode
    // chegar de novo pelo listener: o identificador evita abrir duas vezes.
    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
      const key = response.notification.request.identifier
      if (handled.current.has(key)) return
      handled.current.add(key)
      Notifications.clearLastNotificationResponse()
      const { notificationId, kind, restaurantId } = readData(response)
      if (notificationId) void markNotificationRead(notificationId).catch(() => undefined).finally(() => void refreshInbox())
      openNotificationTarget(kind, restaurantId)
    }

    const last = Notifications.getLastNotificationResponse()
    // Depois do primeiro render das abas, para a navegação já existir.
    const launch = last ? setTimeout(() => open(last), 0) : null
    const responses = Notifications.addNotificationResponseReceivedListener(open)
    const received = Notifications.addNotificationReceivedListener(() => void refreshInbox())
    const tokens = Notifications.addPushTokenListener(() => void syncThisDevice({ force: true }).catch(() => undefined))
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      void refreshInbox()
      void syncThisDevice().catch(() => undefined)
    })
    void syncThisDevice().catch(() => undefined)

    return () => {
      if (launch) clearTimeout(launch)
      responses.remove()
      received.remove()
      tokens.remove()
      appState.remove()
    }
  }, [queryClient])

  useEffect(() => {
    if (pushSupported) void Notifications.setBadgeCountAsync(count).catch(() => undefined)
  }, [count])

  // Saiu da conta: o ícone não fica com o número de quem saiu.
  useEffect(() => () => {
    if (pushSupported) void Notifications.setBadgeCountAsync(0).catch(() => undefined)
  }, [])

  return null
}
