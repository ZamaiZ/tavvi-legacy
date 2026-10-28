import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { uuidSchema } from '@/domain/common'
import { FinanceScreen } from '@/features/finance/components/finance-screen'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import { getFinanceDashboard, getLegacyFinanceReport } from '@/server/dal/finance'

export const metadata: Metadata = { title: 'Financeiro' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const workspace = await getRestaurantWorkspace(parsed.data)
  if (workspace?.role !== 'admin' && workspace?.role !== 'cashier') notFound()
  const restaurantId = workspace.restaurant.id
  const [initialDashboard, initialLegacyReport] = await Promise.all([
    getFinanceDashboard({ restaurantId }),
    getLegacyFinanceReport({ restaurantId }),
  ])
  return <FinanceScreen
    restaurantId={restaurantId}
    restaurantName={workspace.restaurant.name}
    role={workspace.role}
    initialDashboard={initialDashboard}
    initialLegacyReport={initialLegacyReport}
  />
}
