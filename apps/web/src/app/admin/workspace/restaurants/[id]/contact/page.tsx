import { notFound } from 'next/navigation'
import { ProfileForm } from '@/features/workspace/components/profile-form'
import { PageHeader } from '@/components/shell/page-header'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { uuidSchema } from '@/domain/common'
import { requireRestaurantAdmin } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { themeSchema } from '@/domain/theme'

export const metadata = { title: 'Contato' }

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
  await requireRestaurantAdmin(restaurant.id)
  const parsedTheme = themeSchema.safeParse(restaurant.theme ?? {})
  const previewTheme = parsedTheme.success
    ? parsedTheme.data
    : { preset: 'grao' as const, base: null, accent: null, density: 'confortavel' as const }

  return (
    <main className="tv-contact-page">
      <MobileNavBar backHref={`/restaurantes/${restaurant.id}/ajustes`} backLabel="Ajustes" />
      <PageHeader
        className="tv-page-header"
        eyebrow="Informações públicas"
        title="Contato"
        description="Telefone, WhatsApp e endereço viram botões no topo do cardápio."
      />
      <ProfileForm
        restaurantId={restaurant.id}
        name={restaurant.name}
        description={restaurant.description}
        contact={restaurant.contact}
        theme={previewTheme}
        coverPath={restaurant.coverPath}
      />
    </main>
  )
}
