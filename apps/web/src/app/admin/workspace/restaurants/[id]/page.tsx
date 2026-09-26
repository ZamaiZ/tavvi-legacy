import { notFound } from 'next/navigation'
import { MenuWorkspace } from '@/features/workspace/components/menu-workspace'
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

  return <MenuWorkspace
    restaurantId={restaurant.id}
    restaurantName={restaurant.name}
    status={restaurant.status}
    publicUrl={publicUrl}
    logoPath={restaurant.logoPath}
    coverPath={restaurant.coverPath}
    categories={categories}
    canEdit={canEdit}
  />
}
