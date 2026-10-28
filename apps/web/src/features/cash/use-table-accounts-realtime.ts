'use client'

import { useEffect, useState } from 'react'
import { openPrivateBroadcastChannel } from '@/features/notifications/realtime'

export function useTableAccountsRealtime(restaurantId: string, refresh: () => void) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    let active = true
    let generation = 0
    let close: (() => void) | null = null
    let refreshTimer: number | null = null
    let retryTimer: number | null = null
    let retryAttempt = 0
    let channelStatus: 'connecting' | 'connected' | 'disconnected' = 'connecting'

    const scheduleRefresh = () => {
      if (refreshTimer !== null) return
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active && document.visibilityState === 'visible') refresh()
      }, 1500)
    }

    const reconnect = () => {
      if (!active || retryTimer !== null || document.visibilityState !== 'visible') return
      const delay = Math.min(5000 * 2 ** retryAttempt, 60_000)
      retryAttempt++
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        void connect()
      }, delay)
    }

    async function connect() {
      const current = ++generation
      close?.()
      close = null
      channelStatus = 'connecting'
      if (active) setStatus('connecting')
      try {
        const dispose = await openPrivateBroadcastChannel(`table_accounts:${restaurantId}`, ['INSERT', 'UPDATE', 'DELETE'], {
          onMessage: scheduleRefresh,
          onResync: scheduleRefresh,
          onStatus: (next) => {
            if (!active || current !== generation) return
            channelStatus = next
            setStatus(next)
            if (next === 'connected') {
              retryAttempt = 0
              if (retryTimer !== null) window.clearTimeout(retryTimer)
              retryTimer = null
            } else reconnect()
          },
        }, scheduleRefresh)
        if (active && current === generation) close = dispose
        else dispose()
      } catch {
        if (active && current === generation) {
          setStatus('disconnected')
          reconnect()
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
      } else if (channelStatus !== 'connected') {
        void connect()
      }
    }
    void connect()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      generation++
      close?.()
      document.removeEventListener('visibilitychange', visibility)
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
  }, [restaurantId, refresh])

  return status
}
