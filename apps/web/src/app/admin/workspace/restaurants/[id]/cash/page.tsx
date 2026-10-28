import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { CashScreen } from '@/features/cash/components/cash-screen'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { getCheckoutSettings, getTableAccountDetails, listCashAccounts } from '@/server/dal/table-accounts'

export const metadata = { title: 'Caixa' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace?.role) notFound()
  const restaurantId = workspace.restaurant.id
  const [accounts, settings] = await Promise.all([
    listCashAccounts(restaurantId),
    getCheckoutSettings(restaurantId),
  ])
  const firstAccount = accounts.active[0] ?? accounts.recentClosed[0] ?? null
  const initialSelectedAccount = firstAccount
    ? await getTableAccountDetails({ restaurantId, accountId: firstAccount.accountId })
    : null
  return <CashScreen
    restaurantId={restaurantId}
    restaurantName={workspace.restaurant.name}
    role={workspace.role}
    initialActive={accounts.active}
    initialRecentClosed={accounts.recentClosed}
    initialSelectedAccount={initialSelectedAccount}
    initialSettings={settings}
  />
}
