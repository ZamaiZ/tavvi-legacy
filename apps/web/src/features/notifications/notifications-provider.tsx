'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { readBroadcast, type NotificationDTO } from '@/domain/notification'
import {
  countUnreadNotificationsAction,
  listUnreadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/notifications'
import { openNotificationsChannel } from './realtime'

export type NotificationsValue = {
  unreadCount: number
  items: NotificationDTO[]
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  markingAll: boolean
  loadMore: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export const NotificationsContext = createContext<NotificationsValue | null>(null)

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error('useNotifications precisa estar dentro de ConsoleShell')
  return value
}

// O popover de conta também abre na escolha de restaurante (TavviShell), que
// não tem central: ali ele pergunta, em vez de quebrar.
export function useOptionalNotifications(): NotificationsValue | null {
  return useContext(NotificationsContext)
}

// O estado da central mora no ConsoleShell (é ele que pinta os badges da
// barra e da conta), e não num provider filho: por isso é um hook, e o
// shell publica o resultado no NotificationsContext.
export function useNotificationsController({
  initialUnread,
  onInsert,
  onDelete,
}: {
  initialUnread: number
  onInsert: (notification: NotificationDTO) => void
  onDelete: (notification: NotificationDTO) => void
}): NotificationsValue {
  const [unreadCount, setUnreadCount] = useState(initialUnread)
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const itemsRef = useRef<NotificationDTO[]>([])
  const handlersRef = useRef({ onInsert, onDelete })
  const resyncTimer = useRef<number | null>(null)

  useEffect(() => {
    itemsRef.current = items
    handlersRef.current = { onInsert, onDelete }
  })

  const refresh = useCallback(async () => {
    const [count, page] = await Promise.all([countUnreadNotificationsAction(), listUnreadNotificationsAction({})])
    if (count.ok) setUnreadCount(count.data)
    else console.error('[notificações] contagem', count.error)
    if (page.ok) {
      setItems(page.data.items)
      setHasMore(page.data.hasMore)
    } else {
      console.error('[notificações] lista', page.error)
    }
  }, [])

  // UPDATE e DELETE chegam em rajada (marcar todas, excluir um feedback).
  // Em vez de fazer contas evento a evento — e descontar duas vezes o que
  // esta própria aba já tirou da lista —, espera a rajada passar e relê.
  const scheduleResync = useCallback(() => {
    if (resyncTimer.current !== null) window.clearTimeout(resyncTimer.current)
    resyncTimer.current = window.setTimeout(() => {
      resyncTimer.current = null
      void refresh()
    }, 400)
  }, [refresh])

  useEffect(() => {
    let active = true
    let dispose: (() => void) | null = null

    void refresh().finally(() => {
      if (active) setLoading(false)
    })

    void openNotificationsChannel({
      onMessage: (event, message) => {
        const { record, old } = readBroadcast(message)
        if (event === 'INSERT') {
          if (!record || record.readAt) return
          setUnreadCount((count) => count + 1)
          setItems((current) => (current.some((item) => item.id === record.id) ? current : [record, ...current]))
          toast.add({ title: record.title, description: record.body, type: 'info' })
          handlersRef.current.onInsert(record)
          return
        }
        if (event === 'DELETE' && old) handlersRef.current.onDelete(old)
        scheduleResync()
      },
      onResync: () => {
        void refresh()
      },
    }).then((close) => {
      if (active) dispose = close
      else close()
    })

    // Aba em segundo plano pode perder eventos (o navegador suspende o
    // WebSocket). Ao voltar, relê.
    function onVisibility() {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      dispose?.()
      document.removeEventListener('visibilitychange', onVisibility)
      if (resyncTimer.current !== null) window.clearTimeout(resyncTimer.current)
    }
  }, [refresh, scheduleResync])

  const loadMore = useCallback(async () => {
    const last = itemsRef.current.at(-1)
    if (!last) return
    setLoadingMore(true)
    const page = await listUnreadNotificationsAction({ cursor: { createdAt: last.createdAt, id: last.id } })
    setLoadingMore(false)
    if (!page.ok) {
      toast.add({ title: page.error, type: 'error' })
      return
    }
    setItems((current) => {
      const seen = new Set(current.map((item) => item.id))
      return [...current, ...page.data.items.filter((item) => !seen.has(item.id))]
    })
    setHasMore(page.data.hasMore)
  }, [])

  // Otimista: tocar no item tira ele da lista na hora e navega. Se o
  // servidor recusar, a lista volta a ser a do banco.
  const markAsRead = useCallback(
    async (id: string) => {
      const existed = itemsRef.current.some((item) => item.id === id)
      setItems((current) => current.filter((item) => item.id !== id))
      if (existed) setUnreadCount((count) => Math.max(0, count - 1))
      const result = await markNotificationReadAction(id)
      if (!result.ok) {
        toast.add({ title: result.error, type: 'error' })
        void refresh()
      }
    },
    [refresh],
  )

  const markAllAsRead = useCallback(async () => {
    setMarkingAll(true)
    const result = await markAllNotificationsReadAction()
    setMarkingAll(false)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    setItems([])
    setUnreadCount(0)
    setHasMore(false)
  }, [])

  return useMemo(
    () => ({ unreadCount, items, hasMore, loading, loadingMore, markingAll, loadMore, markAsRead, markAllAsRead }),
    [unreadCount, items, hasMore, loading, loadingMore, markingAll, loadMore, markAsRead, markAllAsRead],
  )
}
