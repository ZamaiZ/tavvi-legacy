import { useQuery } from '@tanstack/react-query'
import type { MobileRestaurant, MobileRestaurantDetail } from '@/contracts/mobile-api'
import { apiRequest } from '@/lib/api-client'
export const restaurantKeys = { all: ['mobile', 'restaurants'] as const }
export function getRestaurantPresentation(item: MobileRestaurant) { if (item.deletedAt) return { label: 'Removido', tone: 'neutral' as const }; if (item.status === 'active') return { label: 'Ativo', tone: 'accent' as const }; if (item.status === 'suspended') return { label: 'Suspenso', tone: 'warning' as const }; return { label: 'Rascunho', tone: 'neutral' as const } }
export function restaurantDetailKey(id: string) { return [...restaurantKeys.all, id] as const }
export function useRestaurant(id: string) { return useQuery({ queryKey: restaurantDetailKey(id), queryFn: () => apiRequest<MobileRestaurantDetail>(`/api/mobile/v1/restaurants/${id}`), enabled: Boolean(id) }) }
export function useRestaurants() { return useQuery({ queryKey: restaurantKeys.all, queryFn: () => apiRequest<MobileRestaurant[]>('/api/mobile/v1/restaurants') }) }
