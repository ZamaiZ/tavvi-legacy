import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LuArrowLeft } from 'react-icons/lu'
import { RestaurantDetail } from '@/features/platform/components/restaurants/restaurant-detail'
import { uuidSchema } from '@/domain/common'
import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getRestaurantForAdmin } from '@/server/dal/restaurant-read'
import { env } from '@/server/env'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdminPage()
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const restaurant = await getRestaurantForAdmin(parsed.data)
  if (!restaurant || restaurant.deletedAt) notFound()

  return <main className="tv-detail-page">
    <Link href="/restaurantes" className="tv-detail-back"><LuArrowLeft />Voltar para Restaurantes</Link>
    <div className="tv-detail-page-content">
      <header><span>RESTAURANTE</span><h1>Detalhes do restaurante<i>.</i></h1></header>
      <RestaurantDetail restaurant={restaurant} rootDomain={env.NEXT_PUBLIC_ROOT_DOMAIN} standalone />
    </div>
  </main>
}
