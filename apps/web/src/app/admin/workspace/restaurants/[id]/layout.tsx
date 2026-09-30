import type { Viewport } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getRestaurantNavigation } from '@/components/shell/navigation'
import type { NavGroup } from '@/components/shell/navigation.types'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getRestaurantConsoleConfig } from '@/components/shell/console-config'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { restaurantInitials } from '@/lib/initials'
import { publicMediaUrl } from '@/lib/media-url'
import { uuidSchema } from '@/domain/common'
import { getCurrentUser } from '@/server/dal/auth'
import { listMyRestaurants } from '@/server/dal/restaurant-read'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

// Área segura do iPhone (cabeçalho, tab bar e sheets) e cor da barra do
// navegador igual ao fundo agrupado do painel no celular.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F0EB' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0C0A' },
  ],
}

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

  // Só o papel, o nome e os restaurantes da pessoa, e só para montar a
  // casca. A autorização de verdade é de cada página, e depois da DAL, e
  // depois da RLS.
  const [workspace, user, restaurants] = await Promise.all([
    getRestaurantWorkspace(parsed.data),
    getCurrentUser(),
    listMyRestaurants(),
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
    logoUrl: workspace.restaurant.logoPath ? publicMediaUrl('image', workspace.restaurant.logoPath) : null,
    restaurantId: parsed.data,
    canEdit: workspace.canEdit,
    restaurants: restaurants.map((entry) => ({
      id: entry.id,
      name: entry.name,
      logoUrl: entry.logoPath ? publicMediaUrl('image', entry.logoPath) : null,
      initials: restaurantInitials(entry.name),
      roleLabel: entry.role ? MEMBER_ROLE_LABELS[entry.role] : 'Membro',
    })),
  })

  return (
    <ConsoleShell config={config} initialRail={initialRail}>
      {children}
    </ConsoleShell>
  )
}
