import { notFound } from 'next/navigation'
import { ServiceScreen } from '@/features/workspace/components/mobile/service-screen'
import { uuidSchema } from '@/domain/common'
import { requireUser } from '@/server/dal/auth'
import { getMenuForOwner } from '@/server/dal/menu-read'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Serviço' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()

  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  // Qualquer membro vê a disponibilidade; só o administrador altera, e
  // quem barra é a DAL (setItemAvailability) e a RLS.
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()

  const categories = await getMenuForOwner(workspace.restaurant.id)
  return <ServiceScreen restaurantId={workspace.restaurant.id} categories={categories} canEdit={workspace.canEdit} />
}
