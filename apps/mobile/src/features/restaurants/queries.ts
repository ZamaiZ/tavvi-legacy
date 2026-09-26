import { useQuery } from '@tanstack/react-query'
import { API_ROUTES, type RestaurantSummary, type RestaurantDetail } from '@tavvi/api-contracts'
import { apiRequest } from '@/lib/api-client'
export const restaurantKeys = { all: ['platform', 'restaurants'] as const }

export function restaurantDetailKey(id: string) {
  return [...restaurantKeys.all, id] as const
}

export function useRestaurant(id: string) {
  return useQuery({
    queryKey: restaurantDetailKey(id),
    queryFn: () => apiRequest<RestaurantDetail>(API_ROUTES.platform.restaurant(id)),
    enabled: Boolean(id),
  })
}

export function useRestaurants() {
  return useQuery({
    queryKey: restaurantKeys.all,
    queryFn: () => apiRequest<RestaurantSummary[]>(API_ROUTES.platform.restaurants),
  })
}
