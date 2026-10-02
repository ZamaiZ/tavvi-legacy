'use client'

import { useEffect } from 'react'
import { ACTIVE_PANEL_RESTAURANT_COOKIE } from '@/lib/route-paths'

export function ActiveRestaurantCookie({ restaurantId }: { restaurantId: string }) {
  useEffect(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${ACTIVE_PANEL_RESTAURANT_COOKIE}=${restaurantId}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  }, [restaurantId])

  return null
}
