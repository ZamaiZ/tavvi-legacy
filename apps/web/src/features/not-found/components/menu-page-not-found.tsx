'use client'

import Link from 'next/link'
import { usePublicRestaurant } from '@/features/public-menu/components/public-restaurant-context'
import { restaurantInitials } from '@/lib/initials'
import { nfStep } from './nf-step'
import { NotFoundBackButton } from './not-found-back-button'

// Página que não existe dentro de um restaurante publicado. Veste o tema
// dele: o <main> carrega o `data-menu` que o <style> do layout de `[slug]`
// alcança, e as fontes vêm do .site-public do layout (site).
export function MenuPageNotFound() {
  const restaurant = usePublicRestaurant()
  const menuHref = `/${restaurant.slug}`

  return (
    <main data-menu={restaurant.presetId} className="tv-nf tv-nf--menu">
      <div className="tv-nf-column">
        <div className="tv-nf-brand tv-nf-step" style={nfStep(0)}>
          <span className="tv-nf-logo" aria-hidden="true">
            {restaurant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={restaurant.logoUrl} alt="" />
            ) : (
              restaurantInitials(restaurant.name)
            )}
          </span>
          <span className="tv-nf-brand-name">{restaurant.name}</span>
        </div>
        <p className="tv-nf-code" style={nfStep(1)} aria-hidden="true">404</p>
        <h1 className="tv-nf-title tv-nf-step" style={nfStep(2)}>Página não encontrada</h1>
        <p className="tv-nf-text tv-nf-step" style={nfStep(3)}>
          Esta página não existe no cardápio de {restaurant.name}.
        </p>
        <div className="tv-nf-actions tv-nf-step" style={nfStep(4)}>
          <Link href={menuHref} className="tv-nf-primary">Ver o cardápio</Link>
          <NotFoundBackButton fallbackHref={menuHref} className="tv-nf-secondary" />
        </div>
      </div>
    </main>
  )
}
