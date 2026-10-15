import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CashScreen } from '@/features/cash/components/cash-screen'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { getCheckoutSettings, listCashAccounts } from '@/server/dal/table-accounts'

export const metadata = { title: 'Caixa' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace || (workspace.role !== 'admin' && workspace.role !== 'cashier')) notFound()
  const restaurantId = workspace.restaurant.id
  const [accounts, settings] = await Promise.all([
    listCashAccounts(restaurantId),
    getCheckoutSettings(restaurantId),
  ])
  return <CashScreen
    restaurantId={restaurantId}
    restaurantName={workspace.restaurant.name}
    role={workspace.role}
    initialActive={accounts.active}
    initialRecentClosed={accounts.recentClosed}
    initialSettings={settings}
  />
}
