import { RestaurantList } from '@/features/platform/components/restaurants/restaurant-table'
import { uuidSchema } from '@/domain/common'
import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getRestaurantForAdmin } from '@/server/dal/restaurant-read'
import { getCachedAdminRestaurants } from '@/server/dal/admin-console'
import { env } from '@/server/env'

export const metadata = { title: 'Restaurantes' }

export default async function Page({ searchParams }: {
  searchParams: Promise<{ restaurante?: string | string[]; q?: string | string[] }>
}) {
  await requirePlatformAdminPage()

  const params = await searchParams
  const restaurantId = typeof params.restaurante === 'string' ? params.restaurante : null
  const parsedId = restaurantId ? uuidSchema.safeParse(restaurantId) : null
  const [restaurants, selectedRestaurant] = await Promise.all([
    getCachedAdminRestaurants(),
    parsedId?.success ? getRestaurantForAdmin(parsedId.data) : Promise.resolve(null),
  ])
  const invalidDetail = Boolean(
    restaurantId && (!parsedId?.success || !selectedRestaurant || selectedRestaurant.deletedAt),
  )

  return <RestaurantList
    restaurants={restaurants}
    query={typeof params.q === 'string' ? params.q : ''}
    selectedId={selectedRestaurant?.id}
    selectedRestaurant={selectedRestaurant?.deletedAt ? null : selectedRestaurant}
    rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN}
    invalidDetail={invalidDetail}
  />
}
