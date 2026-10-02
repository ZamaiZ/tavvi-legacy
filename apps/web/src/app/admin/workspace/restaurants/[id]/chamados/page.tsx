import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CallsScreen } from '@/features/calls/components/calls-screen'
import { listServiceCalls, getServiceCall } from '@/server/dal/service-calls'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Chamados' }

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()
  const query = await searchParams
  const callId = typeof query.c === 'string' && uuidSchema.safeParse(query.c).success ? query.c : null
  const [pending, resolved, focusedCall] = await Promise.all([
    listServiceCalls({ restaurantId: workspace.restaurant.id, status: 'pending' }),
    listServiceCalls({ restaurantId: workspace.restaurant.id, status: 'resolved' }),
    callId ? getServiceCall({ restaurantId: workspace.restaurant.id, callId }) : Promise.resolve(null),
  ])
  return <CallsScreen restaurantId={workspace.restaurant.id} initialPending={pending} initialResolved={resolved} focusedCall={focusedCall} />
}
