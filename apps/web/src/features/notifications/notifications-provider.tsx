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
  dismiss: (id: string) => void
  freshIds: ReadonlySet<string>
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
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())
  const receivedInsertIds = useRef(new Set<string>())
  const itemsRef = useRef<NotificationDTO[]>([])
  const freshTimers = useRef(new Map<string, number>())
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
      itemsRef.current = page.data.items
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
          const alreadyLoaded = receivedInsertIds.current.has(record.id) || itemsRef.current.some((item) => item.id === record.id)
          if (alreadyLoaded) return
          receivedInsertIds.current.add(record.id)
          itemsRef.current = [record, ...itemsRef.current]
          setUnreadCount((count) => count + 1)
          setItems((current) => current.some((item) => item.id === record.id) ? current : [record, ...current])
          setFreshIds((current) => new Set(current).add(record.id))
          const oldTimer = freshTimers.current.get(record.id)
          if (oldTimer !== undefined) window.clearTimeout(oldTimer)
          freshTimers.current.set(record.id, window.setTimeout(() => {
            freshTimers.current.delete(record.id)
            setFreshIds((current) => { const next = new Set(current); next.delete(record.id); return next })
          }, 1600))
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
      for (const timer of freshTimers.current.values()) window.clearTimeout(timer)
      freshTimers.current.clear()
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
      const next = [...current, ...page.data.items.filter((item) => !seen.has(item.id))]
      itemsRef.current = next
      return next
    })
    setHasMore(page.data.hasMore)
  }, [])

  // Otimista: tocar no item tira ele da lista na hora e navega. Se o
  // servidor recusar, a lista volta a ser a do banco.
  const markAsRead = useCallback(
    async (id: string) => {
      const existed = itemsRef.current.some((item) => item.id === id)
      itemsRef.current = itemsRef.current.filter((item) => item.id !== id)
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
    itemsRef.current = []
    setItems([])
    setUnreadCount(0)
    setHasMore(false)
    const result = await markAllNotificationsReadAction()
    setMarkingAll(false)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      void refresh()
      return
    }
  }, [refresh])

  const dismiss = useCallback((id: string) => {
    const existed = itemsRef.current.some((item) => item.id === id)
    itemsRef.current = itemsRef.current.filter((item) => item.id !== id)
    setItems((current) => current.filter((item) => item.id !== id))
    if (existed) setUnreadCount((count) => Math.max(0, count - 1))
  }, [])

  return useMemo(
    () => ({ unreadCount, items, hasMore, loading, loadingMore, markingAll, loadMore, markAsRead, markAllAsRead, dismiss, freshIds }),
    [unreadCount, items, hasMore, loading, loadingMore, markingAll, loadMore, markAsRead, markAllAsRead, dismiss, freshIds],
  )
}
