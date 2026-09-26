'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LuChevronRight } from 'react-icons/lu'
import type { RestaurantAdminDTO, RestaurantDetailDTO } from '@/domain/restaurant'
import { Toolbar } from '../toolbar'
import { ListHero } from '../list-hero'
import { TvBadge } from '../tv-badge'
import { StateCard } from '../state-card'
import { RestaurantDrawer } from './restaurant-drawer'

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(word))
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'R'
}

export function RestaurantList({ restaurants, query, selectedId, selectedRestaurant, rootDomain, invalidDetail }: {
  restaurants: RestaurantAdminDTO[]
  query: string
  selectedId?: string
  selectedRestaurant: RestaurantDetailDTO | null
  rootDomain: string
  invalidDetail?: boolean
}) {
  const router = useRouter()
  const search = useSearchParams()
  const filtered = useMemo(() => restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.slug} ${restaurant.segment ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [query, restaurants])
  useEffect(() => {
    if (!invalidDetail) return
    const params = new URLSearchParams(search.toString())
    params.delete('restaurante')
    const value = params.toString()
    router.replace(`/restaurantes${value ? `?${value}` : ''}`, { scroll: false })
  }, [invalidDetail, router, search])
  function open(id: string | null) {
    const params = new URLSearchParams(search.toString())
    if (id) params.set('restaurante', id)
    else params.delete('restaurante')
    const value = params.toString()
    router.replace(`/restaurantes${value ? `?${value}` : ''}`, { scroll: false })
  }
  return <div className="tv-console-page">
    <ListHero title="Restaurantes" description="Acompanhe os estabelecimentos, endereços públicos e situação de publicação." summary={`${restaurants.length} ${restaurants.length === 1 ? 'restaurante' : 'restaurantes'}`} />
    <Toolbar kind="restaurants" query={query} />
    {!restaurants.length ? <StateCard icon={<span className="tv-state-store">⌂</span>} title="Nenhum restaurante ainda" description="Restaurantes aparecem aqui quando alguém resgata um convite." /> : !filtered.length ? <div className="tv-no-results" aria-live="polite">Nenhum restaurante encontrado para “{query}”.</div> : <>
      <div role="table" aria-label="Restaurantes" className="tv-table-shell">
        <div role="row" className="tv-table-head tv-restaurant-columns"><span role="columnheader">RESTAURANTE</span><span role="columnheader">ENDEREÇO</span><span role="columnheader">TIPO</span><span role="columnheader">SITUAÇÃO</span><span role="columnheader" /></div>
        {filtered.map((restaurant) => <div role="row" key={restaurant.id} className={`tv-table-row tv-restaurant-columns${selectedId === restaurant.id ? ' is-selected' : ''}`}><button type="button" className="tv-row-hit" aria-label={`Abrir ${restaurant.name}`} onClick={() => open(restaurant.id)} /><div role="cell" className="tv-table-cell"><span className="tv-row-icon is-initials">{initials(restaurant.name)}</span><strong className="tv-row-title">{restaurant.name}</strong></div><span role="cell" className="tv-mono">/{restaurant.slug}</span><span role="cell" className="tv-date-cell">{restaurant.segment ?? 'Não informado'}</span><span role="cell"><TvBadge state={restaurant.status} /></span><span role="cell" className="tv-row-actions always-visible"><LuChevronRight className="tv-row-chevron" /></span></div>)}
      </div>
      <div className="tv-mobile-cards">{filtered.map((restaurant) => <button type="button" key={restaurant.id} className="tv-mobile-card" onClick={() => open(restaurant.id)}><span className="tv-row-icon is-initials">{initials(restaurant.name)}</span><span className="tv-mobile-card-copy"><strong>{restaurant.name}</strong><small>/{restaurant.slug} · {restaurant.segment ?? 'Não informado'}</small></span><TvBadge state={restaurant.status} /><LuChevronRight className="tv-row-chevron" /></button>)}</div>
    </>}
    <RestaurantDrawer restaurant={selectedRestaurant} rootDomain={rootDomain} />
  </div>
}
