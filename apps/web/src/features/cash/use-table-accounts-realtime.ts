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

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        if (active) refresh()
      }, 200)
    }

    const reconnect = () => {
      if (!active || retryTimer !== null) return
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        void connect()
      }, 5000)
    }

    async function connect() {
      const current = ++generation
      close?.()
      close = null
      if (active) setStatus('connecting')
      try {
        const dispose = await openPrivateBroadcastChannel(`table_accounts:${restaurantId}`, ['INSERT', 'UPDATE', 'DELETE'], {
          onMessage: scheduleRefresh,
          onResync: scheduleRefresh,
          onStatus: (next) => {
            if (!active || current !== generation) return
            setStatus(next)
            if (next === 'connected') {
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
