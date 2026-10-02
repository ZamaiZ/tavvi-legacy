import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getRestaurantNavigation } from '@/components/shell/navigation'
import type { NavGroup } from '@/components/shell/navigation.types'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getRestaurantConsoleConfig } from '@/components/shell/console-config'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { restaurantInitials } from '@/lib/initials'
import { publicMediaUrl } from '@/lib/media-url'
import { getCurrentUser } from '@/server/dal/auth'
import { countUnreadFeedbackForShell } from '@/server/dal/feedback'
import { countUnreadNotificationsSafe } from '@/server/dal/notifications'
import { getMyDisplayName } from '@/server/dal/profile'
import { listMyRestaurants } from '@/server/dal/restaurant-read'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

// A casca do painel com os dados dela. Vive dentro do <Suspense> do layout:
// enquanto estas consultas rodam, quem entra num restaurante já vê o
// esqueleto do painel, e não uma tela parada.
export async function RestaurantShell({ restaurantId, children }: { restaurantId: string; children: React.ReactNode }) {
  // Só o papel, o nome e os restaurantes da pessoa, e só para montar a
  // casca. A autorização de verdade é de cada página, e depois da DAL, e
  // depois da RLS.
  const [workspace, user, restaurants, displayName, unreadNotifications, unreadFeedback] = await Promise.all([
    getRestaurantWorkspace(restaurantId),
    getCurrentUser(),
    listMyRestaurants(),
    getMyDisplayName(),
    countUnreadNotificationsSafe(),
    countUnreadFeedbackForShell(restaurantId),
  ])
  if (!workspace) notFound()
  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'
  const navigation = getRestaurantNavigation(restaurantId, workspace.canEdit)
  const config = getRestaurantConsoleConfig({
    email: user?.email ?? null,
    displayName,
    roleLabel: workspace.role ? MEMBER_ROLE_LABELS[workspace.role] : 'Membro',
    restaurantName: workspace.restaurant.name,
    homeHref: `/restaurantes/${restaurantId}`,
    navigation: navigation.filter((item): item is NavGroup => item.kind === 'group'),
    logoUrl: workspace.restaurant.logoPath ? publicMediaUrl('image', workspace.restaurant.logoPath) : null,
    restaurantId,
    canEdit: workspace.canEdit,
    restaurants: restaurants.map((entry) => ({
      id: entry.id,
      name: entry.name,
      logoUrl: entry.logoPath ? publicMediaUrl('image', entry.logoPath) : null,
      initials: restaurantInitials(entry.name),
      roleLabel: entry.role ? MEMBER_ROLE_LABELS[entry.role] : 'Membro',
    })),
    unreadNotifications,
    unreadFeedback,
  })

  return (
    <ConsoleShell config={config} initialRail={initialRail}>
      {children}
    </ConsoleShell>
  )
}
