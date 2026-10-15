'use client'

import { useEffect } from 'react'
import { openPrivateBroadcastChannel } from '@/features/notifications/realtime'

export function useServiceCallsRealtime(restaurantId: string, refresh: (messages?: unknown[]) => void) {
  useEffect(() => {
    if (!restaurantId) return
    let active = true
    let close: (() => void) | null = null
    let timer: number | null = null
    const pendingMessages: unknown[] = []
    const schedule = (message?: unknown) => {
      if (message !== undefined) pendingMessages.push(message)
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        if (!active) return
        const messages = pendingMessages.splice(0)
        refresh(messages)
      }, 350)
    }
    function visibility() { if (document.visibilityState === 'visible') schedule() }
    void openPrivateBroadcastChannel(`service_calls:${restaurantId}`, ['INSERT', 'UPDATE'], {
      onMessage: (_event, message) => schedule(message),
      onResync: schedule,
    }, schedule).then((dispose) => { if (active) close = dispose; else dispose() })
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      close?.()
      document.removeEventListener('visibilitychange', visibility)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [restaurantId, refresh])
}
