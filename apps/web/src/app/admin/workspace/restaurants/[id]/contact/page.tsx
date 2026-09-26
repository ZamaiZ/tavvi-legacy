import { notFound } from 'next/navigation'
import { ProfileForm } from '@/features/workspace/components/profile-form'
import { PageHeader } from '@/components/shell/page-header'
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
      <main className="tavvi-page">
      <PageHeader
        className="tv-page-header"
        eyebrow="Informações públicas"
        title="Nome e contato"
        description="Estes dados aparecem no topo do cardápio e ajudam o cliente a encontrar ou chamar o restaurante."
      />
      <ProfileForm
        restaurantId={restaurant.id}
        name={restaurant.name}
        description={restaurant.description}
        contact={restaurant.contact}
        theme={previewTheme}
      />
    </main>
  )
}
