import { useLocalSearchParams } from 'expo-router'
import { RestaurantDetailScreen } from '@/features/restaurants/restaurant-detail-screen'

export default function RestaurantDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <RestaurantDetailScreen id={id} />
}
