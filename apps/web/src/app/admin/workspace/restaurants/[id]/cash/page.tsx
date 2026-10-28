import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CashScreen } from '@/features/cash/components/cash-screen'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { getCheckoutSettings, getTableAccountDetails, listCashAccounts, listPendingCashAccounts } from '@/server/dal/table-accounts'
import { getFinanceDashboard } from '@/server/dal/finance'
import { getOrderableMenu } from '@/server/dal/menu-read'

export const metadata = { title: 'Caixa' }

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace?.role) notFound()
  const restaurantId = workspace.restaurant.id
  const [accounts, pending, settings, financeDashboard, menu] = await Promise.all([
    listCashAccounts(restaurantId),
    listPendingCashAccounts(restaurantId),
    getCheckoutSettings(restaurantId),
    workspace.role === 'admin' || workspace.role === 'cashier'
      ? getFinanceDashboard({ restaurantId })
      : Promise.resolve(null),
    getOrderableMenu(restaurantId),
  ])
  const selectedQuery = typeof query.accountId === 'string' ? uuidSchema.safeParse(query.accountId) : null
  const requestedAccount = selectedQuery?.success
    ? await getTableAccountDetails({ restaurantId, accountId: selectedQuery.data })
    : null
  const requestedPending = requestedAccount?.status === 'pending' ? requestedAccount : null
  const firstAccount = accounts.active[0] ?? pending[0] ?? accounts.recentClosed[0] ?? null
  const initialSelectedAccount = requestedPending ?? (firstAccount
    ? await getTableAccountDetails({ restaurantId, accountId: firstAccount.accountId })
    : null)
  return <CashScreen
    restaurantId={restaurantId}
    restaurantName={workspace.restaurant.name}
    role={workspace.role}
    initialActive={accounts.active}
    initialPending={pending}
    initialRecentClosed={accounts.recentClosed}
    initialSelectedAccount={initialSelectedAccount}
    initialSettings={settings}
    initialFinanceDashboard={financeDashboard}
    menu={menu}
  />
}
