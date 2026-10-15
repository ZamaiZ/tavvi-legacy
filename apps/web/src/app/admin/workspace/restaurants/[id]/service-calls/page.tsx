import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CallsScreen } from '@/features/calls/components/calls-screen'
import {
  getServiceCall,
  listServiceCallTeam,
  listServiceCalls,
} from '@/server/dal/service-calls'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { requireUser } from '@/server/dal/auth'

export const metadata = { title: 'Chamados' }

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const [workspace, user] = await Promise.all([
    getRestaurantWorkspace(parsed.data),
    requireUser(),
  ])
  if (!workspace?.role) notFound()

  const query = await searchParams
  const callId = typeof query.c === 'string' && uuidSchema.safeParse(query.c).success ? query.c : null
  const [pending, inProgress, resolved, team, focusedCall] = await Promise.all([
    listServiceCalls({ restaurantId: workspace.restaurant.id, status: 'pending' }),
    listServiceCalls({ restaurantId: workspace.restaurant.id, status: 'in_progress' }),
    listServiceCalls({ restaurantId: workspace.restaurant.id, status: 'resolved' }),
    listServiceCallTeam({ restaurantId: workspace.restaurant.id }),
    callId ? getServiceCall({ restaurantId: workspace.restaurant.id, callId }) : Promise.resolve(null),
  ])

  return <CallsScreen
    restaurantId={workspace.restaurant.id}
    userId={user.id}
    role={workspace.role}
    serverNow={new Date().toISOString()}
    initialPending={pending}
    initialInProgress={inProgress}
    initialResolved={resolved}
    initialTeam={team}
    focusedCall={focusedCall}
  />
}
