'use client'

import { createContext, useContext } from 'react'
import type { ResolvedTheme } from '@/lib/theme/resolve'

// O que a 404 "página" do cardápio precisa saber do restaurante. O layout de
// `[slug]` já carregou tudo isto; a fronteira not-found não recebe params,
// então o dado chega por contexto.
export type PublicRestaurant = {
  slug: string
  name: string
  logoUrl: string | null
  presetId: ResolvedTheme['presetId']
}

const PublicRestaurantContext = createContext<PublicRestaurant | null>(null)

export function PublicRestaurantProvider({
  value,
  children,
}: {
  value: PublicRestaurant
  children: React.ReactNode
}) {
  return <PublicRestaurantContext.Provider value={value}>{children}</PublicRestaurantContext.Provider>
}

export function usePublicRestaurant(): PublicRestaurant {
  const restaurant = useContext(PublicRestaurantContext)
  if (!restaurant) throw new Error('usePublicRestaurant precisa do PublicRestaurantProvider do layout de (site)/[slug].')
  return restaurant
}
