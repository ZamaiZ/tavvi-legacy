import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CallsScreen } from '@/features/calls/components/calls-screen'
import {
  getServiceCall,
  getServiceCallsDashboard,
  listServiceCalls,
  listServiceCallTeam,
} from '@/server/dal/service-calls'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { requireUser } from '@/server/dal/auth'
import { getOrderableMenu } from '@/server/dal/menu-read'
import { getTableAccountForTable } from '@/server/dal/table-accounts'

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
  const dashboard = await getServiceCallsDashboard({
    restaurantId: workspace.restaurant.id,
    selectedCallId: callId,
  })
  for (const [field, error] of Object.entries(dashboard.errors)) {
    console.error(`[service-calls] initial dashboard ${field} load failed`, error)
  }
  const restaurantId = workspace.restaurant.id
  const [initialPending, initialInProgress, initialResolved, initialTeam, focusedCall] = await Promise.all([
    dashboard.pending ?? listServiceCalls({ restaurantId, status: 'pending' }),
    dashboard.inProgress ?? listServiceCalls({ restaurantId, status: 'in_progress' }),
    dashboard.resolved ?? listServiceCalls({ restaurantId, status: 'resolved' }),
    dashboard.team ?? listServiceCallTeam({ restaurantId }),
    dashboard.selectedCall !== undefined
      ? Promise.resolve(dashboard.selectedCall)
      : callId ? getServiceCall({ restaurantId, callId }) : Promise.resolve(null),
  ])
  const canRecordOrders = workspace.role === 'attendant' || workspace.role === 'waiter'
  const [orderableMenu, initialAccount] = await Promise.all([
    canRecordOrders ? getOrderableMenu(restaurantId) : Promise.resolve([]),
    canRecordOrders && focusedCall?.status === 'in_progress' && focusedCall.assignedTo === user.id
      ? getTableAccountForTable({ restaurantId, tableNumber: focusedCall.tableNumber })
      : Promise.resolve(null),
  ])

  return <CallsScreen
    restaurantId={restaurantId}
    userId={user.id}
    role={workspace.role}
    serverNow={new Date().toISOString()}
    initialPending={initialPending}
    initialInProgress={initialInProgress}
    initialResolved={initialResolved}
    initialTeam={initialTeam}
    focusedCall={focusedCall}
    orderableMenu={orderableMenu}
    initialAccount={initialAccount}
  />
}
