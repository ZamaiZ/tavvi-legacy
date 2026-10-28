'use client'

import { useEffect, useRef, useState } from 'react'
import { openPrivateBroadcastChannel } from '@/features/notifications/realtime'

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export function useFinanceRealtime(restaurantId: string, refresh: () => void) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!restaurantId) {
      setStatus('disconnected')
      return
    }

    const topics = [`table_accounts:${restaurantId}`, `restaurant_finance:${restaurantId}`]
    let active = true
    let generation = 0
    let disposers: Array<() => void> = []
    let refreshTimer: number | null = null
    let retryTimer: number | null = null
    const topicStatuses = new Map<string, RealtimeStatus>()

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active) refreshRef.current()
      }, 250)
    }

    const reconnect = () => {
      if (!active || retryTimer !== null) return
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        void connect()
      }, 5000)
    }

    const updateStatus = () => {
      const statuses = [...topicStatuses.values()]
      const next: RealtimeStatus = statuses.length === topics.length && statuses.every((value) => value === 'connected')
        ? 'connected'
        : statuses.some((value) => value === 'disconnected') ? 'disconnected' : 'connecting'
      setStatus(next)
      if (next === 'connected') {
        if (retryTimer !== null) window.clearTimeout(retryTimer)
        retryTimer = null
      } else if (next === 'disconnected') reconnect()
    }

    async function connect() {
      const current = ++generation
      disposers.forEach((dispose) => dispose())
      disposers = []
      topicStatuses.clear()
      topics.forEach((topic) => topicStatuses.set(topic, 'connecting'))
      updateStatus()

      try {
        for (const topic of topics) {
          const dispose = await openPrivateBroadcastChannel(topic, ['INSERT', 'UPDATE', 'DELETE'], {
            onMessage: scheduleRefresh,
            onResync: scheduleRefresh,
            onStatus: (next) => {
              if (!active || current !== generation) return
              topicStatuses.set(topic, next)
              updateStatus()
            },
          }, scheduleRefresh)
          if (!active || current !== generation) {
            dispose()
            return
          }
          disposers.push(dispose)
        }
      } catch {
        if (active && current === generation) {
          disposers.forEach((dispose) => dispose())
          disposers = []
          topics.forEach((topic) => topicStatuses.set(topic, 'disconnected'))
          updateStatus()
        }
      }
    }

    const visibility = () => {
      if (document.visibilityState !== 'visible') return
      scheduleRefresh()
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
        retryTimer = null
        void connect()
      }
    }

    void connect()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      generation++
      disposers.forEach((dispose) => dispose())
      document.removeEventListener('visibilitychange', visibility)
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
  }, [restaurantId])

  return status
}
