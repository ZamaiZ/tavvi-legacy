import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getRestaurantNavigation } from '@/components/shell/navigation'
import type { NavGroup } from '@/components/shell/navigation.types'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getRestaurantConsoleConfig } from '@/components/shell/console-config'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { uuidSchema } from '@/domain/common'
import { getCurrentUser } from '@/server/dal/auth'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  // Só o papel e o nome, e só para montar a casca. A autorização de verdade é
  // de cada página, e depois da DAL, e depois da RLS.
  const [workspace, user] = await Promise.all([
    getRestaurantWorkspace(parsed.data),
    getCurrentUser(),
  ])
  if (!workspace) notFound()
  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'
  const navigation = getRestaurantNavigation(parsed.data, workspace.canEdit)
  const config = getRestaurantConsoleConfig({
    email: user?.email ?? null,
    roleLabel: workspace.role ? MEMBER_ROLE_LABELS[workspace.role] : 'Membro',
    restaurantName: workspace.restaurant.name,
    homeHref: `/restaurantes/${parsed.data}`,
    navigation: navigation.filter((item): item is NavGroup => item.kind === 'group'),
  })

  return (
    <ConsoleShell config={config} initialRail={initialRail}>
      {children}
    </ConsoleShell>
  )
}
