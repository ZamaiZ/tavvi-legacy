'use client'

import { useSelectedLayoutSegments } from 'next/navigation'
import type { ReactNode } from 'react'

export function RestaurantRouteLoading({
  skeletons,
}: {
  skeletons: Record<string, ReactNode>
}) {
  const segments = useSelectedLayoutSegments().filter((segment) => !segment.startsWith('('))
  const route = segments.join('/')

  return <>{skeletons[route] ?? null}</>
}
