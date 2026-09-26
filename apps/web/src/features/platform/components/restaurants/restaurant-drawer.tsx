'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LuX } from 'react-icons/lu'
import type { RestaurantDetailDTO } from '@/domain/restaurant'
import { RestaurantDetail } from './restaurant-detail'

export function RestaurantDrawer({ restaurant, rootDomain }: { restaurant: RestaurantDetailDTO | null; rootDomain: string }) {
  const router = useRouter()
  const search = useSearchParams()
  if (!restaurant) return null
  function close() {
    const params = new URLSearchParams(search.toString())
    params.delete('restaurante')
    const query = params.toString()
    router.replace(`/restaurantes${query ? `?${query}` : ''}`, { scroll: false })
  }
  return <><button type="button" className="tv-drawer-scrim" aria-label="Fechar detalhe" onClick={close} /><aside role="dialog" aria-modal="true" aria-labelledby="tv-restaurant-drawer-title" className="tv-detail-drawer"><header><h2 id="tv-restaurant-drawer-title">Restaurante</h2><button type="button" className="tv-icon-button" aria-label="Fechar" onClick={close}><LuX /></button></header><div className="tv-drawer-body"><RestaurantDetail restaurant={restaurant} rootDomain={rootDomain} /></div></aside></>
}
