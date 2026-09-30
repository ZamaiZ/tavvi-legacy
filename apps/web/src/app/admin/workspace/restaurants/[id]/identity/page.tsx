import { notFound } from 'next/navigation'
import { IdentityForm } from '@/features/workspace/components/identity-form'
import { PageHeader } from '@/components/shell/page-header'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { uuidSchema } from '@/domain/common'
import { requireRestaurantAdmin } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Identidade' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()
  const { restaurant } = workspace

  // Identidade é do administrador. A página confirma antes de desenhar, e a
  // DAL confirma de novo ao gravar.
  await requireRestaurantAdmin(restaurant.id)

  return (
    <main className="tv-identity-page">
      <MobileNavBar backHref={`/restaurantes/${restaurant.id}/ajustes`} backLabel="Ajustes" />
      <PageHeader
        className="tv-page-header"
        eyebrow="Marca"
        title="Identidade"
        description="Logo, capa, tema e cores do cardápio público."
      />
      <IdentityForm
        restaurantId={restaurant.id}
        name={restaurant.name}
        segment={restaurant.segment}
        theme={restaurant.theme}
        logoPath={restaurant.logoPath}
        coverPath={restaurant.coverPath}
      />
    </main>
  )
}
