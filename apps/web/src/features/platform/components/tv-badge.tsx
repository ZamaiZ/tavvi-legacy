import type { InviteState } from '@/domain/invite'
import type { RestaurantStatus } from '@/domain/restaurant'

type BadgeState = InviteState | RestaurantStatus

const labels: Record<BadgeState, string> = {
  pending: 'Pendente',
  redeemed: 'Resgatado',
  expired: 'Vencido',
  revoked: 'Revogado',
  draft: 'Rascunho',
  active: 'Ativo',
  suspended: 'Suspenso',
}

const tones: Record<BadgeState, string> = {
  pending: 'accent', redeemed: 'ok', expired: 'warn', revoked: 'neutral',
  draft: 'neutral', active: 'ok', suspended: 'warn',
}

export function badgeLabel(state: BadgeState) {
  return labels[state]
}

// Badge de situação: pílula de 20 px com ponto de 5 px na cor do texto.
export function TvBadge({ state }: { state: BadgeState }) {
  return <span className={`tv-badge tv-tone-${tones[state]}`}>{labels[state]}</span>
}
