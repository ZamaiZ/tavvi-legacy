import { notFound } from 'next/navigation'
import { RestaurantDetail } from '@/features/platform/components/restaurants/restaurant-detail'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { uuidSchema } from '@/domain/common'
import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getRestaurantForAdmin, listRestaurantMembersForAdmin } from '@/server/dal/restaurant-read'
import { env } from '@/server/env'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdminPage()
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const [restaurant, members] = await Promise.all([
    getRestaurantForAdmin(parsed.data),
    listRestaurantMembersForAdmin(parsed.data),
  ])
  if (!restaurant || restaurant.deletedAt) notFound()

  return <main className="tv-detail-page">
    <MobileNavBar backHref="/restaurantes" backLabel="Restaurantes" />
    <div className="tv-detail-page-content">
      <header><span>RESTAURANTE</span><h1>Detalhes do restaurante<i>.</i></h1></header>
      <RestaurantDetail restaurant={restaurant} members={members} rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN} standalone />
    </div>
  </main>
}
