import type { RestaurantSummary } from '@tavvi/api-contracts'

export function getRestaurantPresentation(item: RestaurantSummary) {
  if (item.deletedAt) return { label: 'Removido', tone: 'neutral' as const }
  if (item.status === 'active') return { label: 'Ativo', tone: 'accent' as const }
  if (item.status === 'suspended') return { label: 'Suspenso', tone: 'warning' as const }
  return { label: 'Rascunho', tone: 'neutral' as const }
}
