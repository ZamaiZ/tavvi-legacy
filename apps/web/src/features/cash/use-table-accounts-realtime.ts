'use client'

import { useEffect } from 'react'
import { openPrivateBroadcastChannel } from '@/features/notifications/realtime'

export function useTableAccountsRealtime(restaurantId: string, refresh: () => void) {
  useEffect(() => {
    let active = true
    let close: (() => void) | null = null
    let timer: number | null = null
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        if (active) refresh()
      }, 200)
    }
    const visibility = () => { if (document.visibilityState === 'visible') schedule() }
    void openPrivateBroadcastChannel(`table_accounts:${restaurantId}`, ['INSERT', 'UPDATE', 'DELETE'], {
      onMessage: schedule,
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
