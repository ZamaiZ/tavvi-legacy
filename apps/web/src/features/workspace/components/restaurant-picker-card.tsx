import type { RestaurantPickerDTO } from '@/domain/restaurant'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { TvBadge } from '@/features/platform/components/tv-badge'
import { restaurantInitials } from '@/lib/initials'
import { publicMediaUrl } from '@/lib/media-url'
import { RestaurantPickerContextMenu } from './restaurant-picker-context-menu'

// Cartão do seletor (Tavvi Web.dc.html, rPicker). O cartão inteiro é o link,
// que o menu de contexto (componente de cliente) renderiza.
// Sem capa: hachura neutra. Sem logo: iniciais no dourado.
export function RestaurantPickerCard({ restaurant, domain }: { restaurant: RestaurantPickerDTO; domain: string }) {
  const coverUrl = restaurant.coverPath ? publicMediaUrl('image', restaurant.coverPath) : null
  const logoUrl = restaurant.logoPath ? publicMediaUrl('image', restaurant.logoPath) : null

  return (
    <RestaurantPickerContextMenu restaurant={restaurant} domain={domain}>
      <span className="tv-picker-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {coverUrl ? <img src={coverUrl} alt="" /> : null}
        <span className={`tv-picker-mark${logoUrl ? ' is-logo' : ''}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="" /> : restaurantInitials(restaurant.name)}
        </span>
      </span>
      <span className="tv-picker-body">
        <strong>{restaurant.name}</strong>
        <span className="tv-picker-url">{domain}/{restaurant.slug}</span>
        <span className="tv-picker-meta">
          <TvBadge state={restaurant.status} />
          {restaurant.role ? <span className="tv-picker-role">{MEMBER_ROLE_LABELS[restaurant.role]}</span> : null}
        </span>
      </span>
    </RestaurantPickerContextMenu>
  )
}
