import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { PlaquinhasScreen } from '@/features/workspace/components/plaquinhas-screen'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { listTags } from '@/server/dal/tags'

export const metadata = { title: 'Plaquinhas' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace || !workspace.canEdit) notFound()
  const tags = await listTags(workspace.restaurant.id)
  return <PlaquinhasScreen restaurantId={workspace.restaurant.id} initialTags={tags} />
}
