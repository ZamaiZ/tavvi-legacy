'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LuCircleCheck, LuChevronRight, LuPause, LuPencilLine, LuStore } from 'react-icons/lu'
import type { RestaurantAdminDTO, RestaurantDetailDTO } from '@/domain/restaurant'
import { isMobileViewport, markStackedFromList } from '@/lib/viewport'
import { Toolbar } from '../toolbar'
import { ListHero } from '../list-hero'
import { TvBadge } from '../tv-badge'
import { StateCard } from '../state-card'
import { useServerSelection } from '../use-detail-selection'
import { RestaurantDrawer } from './restaurant-drawer'
import { restaurantInitials } from './use-restaurant-detail'

export function RestaurantList({ restaurants, query, selectedId, selectedRestaurant, rootDomain, invalidDetail }: {
  restaurants: RestaurantAdminDTO[]
  query: string
  selectedId?: string
  selectedRestaurant: RestaurantDetailDTO | null
  rootDomain: string
  invalidDetail?: boolean
}) {
  const router = useRouter()
  const [openId, selectRestaurant] = useServerSelection('restaurante', '/restaurantes', selectedId ?? null)
  const openRow = openId ? restaurants.find((restaurant) => restaurant.id === openId) : undefined
  const activeCount = restaurants.filter((restaurant) => restaurant.status === 'active' && !restaurant.deletedAt).length
  const draftCount = restaurants.filter((restaurant) => restaurant.status === 'draft' && !restaurant.deletedAt).length
  const suspendedCount = restaurants.filter((restaurant) => restaurant.status === 'suspended' && !restaurant.deletedAt).length
  const filtered = useMemo(() => restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.slug} ${restaurant.segment ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [query, restaurants])

  useEffect(() => {
    if (invalidDetail) selectRestaurant(null)
  }, [invalidDetail, selectRestaurant])
  // Link antigo com ?restaurante= aberto no celular vai para a tela empilhada.
  useEffect(() => {
    if (selectedId && isMobileViewport()) router.replace(`/restaurantes/${selectedId}`, { scroll: false })
  }, [router, selectedId])

  function open(id: string) {
    if (isMobileViewport()) {
      markStackedFromList(`/restaurantes/${id}`)
      router.push(`/restaurantes/${id}`)
      return
    }
    selectRestaurant(id)
  }

  return <div className="tv-console-page">
    <header className="tv-m-page-head tv-m-only"><h1 className="tv-m-title">Restaurantes</h1><p className="tv-m-subtitle">Estabelecimentos da plataforma</p></header>
    <ListHero
      title="Restaurantes"
      description="Acompanhe os estabelecimentos, endereços públicos e situação de publicação."
      hero={{
        label: 'Restaurantes na plataforma',
        value: restaurants.length,
        detail: `${restaurants.length === 1 ? 'cadastrado' : 'cadastrados'} · ${activeCount} com cardápio no ar`,
        compact: true,
      }}
      stats={[
        { label: 'Ativos', value: activeCount, icon: <LuCircleCheck aria-hidden="true" /> },
        { label: 'Rascunho', value: draftCount, icon: <LuPencilLine aria-hidden="true" /> },
        { label: 'Suspensos', value: suspendedCount, icon: <LuPause aria-hidden="true" /> },
      ]}
    />
    <Toolbar kind="restaurants" query={query} />
    {!restaurants.length ? <StateCard icon={<LuStore />} title="Nenhum restaurante ainda" description="Restaurantes aparecem aqui quando alguém resgata um convite." /> : !filtered.length ? <>
      <div className="tv-no-results tv-d-only" aria-live="polite">Nenhum restaurante encontrado para “{query}”.</div>
      <div className="tv-m-empty tv-m-only" aria-live="polite"><strong>Nada encontrado</strong><span>Ajuste a busca para ver outros restaurantes.</span></div>
    </> : <>
      <div role="table" aria-label="Restaurantes" className="tv-table-shell">
        <div role="row" className="tv-table-head tv-restaurant-columns">
          <span role="columnheader">Restaurante</span>
          <span role="columnheader">Endereço</span>
          <span role="columnheader">Tipo</span>
          <span role="columnheader">Situação</span>
          <span role="columnheader"><span className="sr-only">Abrir</span></span>
        </div>
        {filtered.map((restaurant) => <div role="row" key={restaurant.id} className={`tv-table-row tv-restaurant-columns${openId === restaurant.id ? ' is-selected' : ''}`}>
          <button type="button" className="tv-row-hit" aria-label={`Abrir ${restaurant.name}`} onClick={() => open(restaurant.id)} />
          <div role="cell" className="tv-table-cell"><span className="tv-row-icon is-initials" aria-hidden="true">{restaurantInitials(restaurant.name)}</span><strong className="tv-row-title">{restaurant.name}</strong></div>
          <span role="cell" className="tv-slug-cell">/{restaurant.slug}</span>
          <span role="cell" className="tv-text-cell">{restaurant.segment ?? 'Não informado'}</span>
          <span role="cell"><TvBadge state={restaurant.status} /></span>
          <span role="cell" className="tv-row-end"><LuChevronRight className="tv-row-chevron" aria-hidden="true" /></span>
        </div>)}
      </div>
      <div className="tv-mobile-cards">{filtered.map((restaurant) => <button type="button" key={restaurant.id} className="tv-mobile-card" onClick={() => open(restaurant.id)}><span className="tv-row-icon is-initials">{restaurantInitials(restaurant.name)}</span><span className="tv-mobile-card-copy"><strong>{restaurant.name}</strong><small>/{restaurant.slug} · {restaurant.segment ?? 'Não informado'}</small></span><TvBadge state={restaurant.status} /><LuChevronRight className="tv-row-chevron" /></button>)}</div>
    </>}
    <RestaurantDrawer openId={openId} row={openRow} restaurant={selectedRestaurant} rootDomain={rootDomain} onClose={() => selectRestaurant(null)} />
  </div>
}
