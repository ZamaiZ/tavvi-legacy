'use client'

import type { RestaurantAdminDTO, RestaurantDetailDTO } from '@/domain/restaurant'
import { DetailDrawer } from '../detail-drawer'
import { TvBadge } from '../tv-badge'
import { RestaurantDetail } from './restaurant-detail'
import { restaurantInitials } from './use-restaurant-detail'

// O drawer abre no clique. Enquanto o detalhe não chega do servidor, o topo
// usa a linha da lista e os blocos mostram o esqueleto na mesma forma.
export function RestaurantDrawer({ openId, row, restaurant, rootDomain, onClose }: {
  openId: string | null
  row: RestaurantAdminDTO | undefined
  restaurant: RestaurantDetailDTO | null
  rootDomain: string
  onClose: () => void
}) {
  if (!openId) return null
  const ready = restaurant?.id === openId ? restaurant : null
  return <DetailDrawer label="Restaurante" width={400} onClose={onClose}>
    {ready ? <RestaurantDetail key={ready.id} restaurant={ready} rootDomain={rootDomain} /> : <RestaurantDetailSkeleton row={row} />}
  </DetailDrawer>
}

function RestaurantDetailSkeleton({ row }: { row: RestaurantAdminDTO | undefined }) {
  return <div className="tv-detail-stack is-restaurant" aria-busy="true" aria-label="Carregando restaurante">
    <section className="tv-detail-hero">
      <div className="tv-detail-top">
        {row ? <span className="tv-restaurant-initials" aria-hidden="true">{restaurantInitials(row.name)}</span> : <span className="tv-skeleton tv-sk-initials" />}
        {row ? <TvBadge state={row.status} /> : <span className="tv-skeleton tv-sk-badge" />}
      </div>
      {row ? <>
        <h2>{row.name}</h2>
        <p>{row.segment ?? 'Não informado'}</p>
      </> : <>
        <span className="tv-skeleton tv-sk-title" />
        <span className="tv-skeleton tv-sk-line is-short" />
      </>}
    </section>
    <div className="tv-detail-section" aria-hidden="true">
      <span className="tv-skeleton tv-sk-label" />
      <span className="tv-skeleton tv-sk-field is-tall" />
    </div>
    <div className="tv-detail-section" aria-hidden="true">
      <span className="tv-skeleton tv-sk-label" />
      <span className="tv-skeleton tv-sk-field" />
      <span className="tv-skeleton tv-sk-line" />
      <span className="tv-skeleton tv-sk-line is-short" />
      <span className="tv-skeleton tv-sk-button" />
    </div>
    <div className="tv-detail-section" aria-hidden="true">
      <span className="tv-skeleton tv-sk-label" />
      <span className="tv-skeleton tv-sk-option" />
      <span className="tv-skeleton tv-sk-option" />
      <span className="tv-skeleton tv-sk-option" />
    </div>
    <span className="tv-skeleton tv-sk-info" aria-hidden="true" />
    <span className="tv-skeleton tv-sk-remove" aria-hidden="true" />
  </div>
}
