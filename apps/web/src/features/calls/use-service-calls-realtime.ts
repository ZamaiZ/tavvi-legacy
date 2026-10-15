'use client'

import { useEffect } from 'react'
import { openPrivateBroadcastChannel } from '@/features/notifications/realtime'

export function useServiceCallsRealtime(restaurantId: string, refresh: (messages?: unknown[]) => void) {
  useEffect(() => {
    if (!restaurantId) return
    let active = true
    let generation = 0
    let close: (() => void) | null = null
    let timer: number | null = null
    let retryTimer: number | null = null
    const pendingMessages: unknown[] = []

    const schedule = (message?: unknown) => {
      if (message !== undefined) pendingMessages.push(message)
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        if (!active) return
        refresh(pendingMessages.splice(0))
      }, 350)
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
      try {
        const dispose = await openPrivateBroadcastChannel(`service_calls:${restaurantId}`, ['INSERT', 'UPDATE'], {
          onMessage: (_event, message) => schedule(message),
          onResync: schedule,
          onStatus: (next) => {
            if (!active || current !== generation) return
            if (next === 'connected') {
              if (retryTimer !== null) window.clearTimeout(retryTimer)
              retryTimer = null
            } else reconnect()
          },
        }, schedule)
        if (active && current === generation) close = dispose
        else dispose()
      } catch {
        if (active && current === generation) reconnect()
      }
    }

    const visibility = () => {
      if (document.visibilityState !== 'visible') return
      schedule()
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
      if (timer !== null) window.clearTimeout(timer)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
  }, [restaurantId, refresh])
}
