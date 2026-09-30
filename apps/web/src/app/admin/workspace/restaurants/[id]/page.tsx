import { notFound } from 'next/navigation'
import { MenuWorkspace } from '@/features/workspace/components/menu-workspace'
import { MenuMobile } from '@/features/workspace/components/mobile/menu-mobile'
import { uuidSchema } from '@/domain/common'
import { requireUser } from '@/server/dal/auth'
import { getMenuForOwner } from '@/server/dal/menu-read'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { env } from '@/server/env'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const workspace = await getRestaurantWorkspace(parsed.data)
  // Restaurante de outra pessoa cai em 404, não em "sem permissão": não
  // confirmamos nem que o id existe.
  if (!workspace) notFound()

  const { restaurant, canEdit } = workspace

  // O papel decide o que APARECE. Quem chamar a action na mão continua barrado
  // pela DAL e pela RLS — são três camadas dizendo a mesma coisa.
  const categories = await getMenuForOwner(restaurant.id)
  const publicUrl = `http://${env.NEXT_PUBLIC_ROOT_DOMAIN}/${restaurant.slug}`

  // Duas árvores, alternadas por CSS: o celular (Tavvi Mobile.dc.html) não é
  // o desktop encolhido, e o servidor não sabe a largura da tela.
  return (
    <>
      <div className="tv-d-only">
        <MenuWorkspace
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          status={restaurant.status}
          publicUrl={publicUrl}
          logoPath={restaurant.logoPath}
          coverPath={restaurant.coverPath}
          onboardingCompleted={Boolean(restaurant.onboardingCompletedAt)}
          theme={restaurant.theme}
          categories={categories}
          canEdit={canEdit}
        />
      </div>
      <div className="tv-m-only">
        <MenuMobile
          restaurantId={restaurant.id}
          status={restaurant.status}
          publicUrl={publicUrl}
          logoPath={restaurant.logoPath}
          coverPath={restaurant.coverPath}
          categories={categories}
          canEdit={canEdit}
        />
      </div>
    </>
  )
}
