import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ShellSkeleton } from '@/components/shell/shell-skeleton'
import { uuidSchema } from '@/domain/common'
import { RestaurantRouteLoading } from '@/features/workspace/components/restaurant-route-loading'
import { RestaurantShell } from '@/features/workspace/components/restaurant-shell'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'
import MenuLoading from './loading'
import CallsLoading from './service-calls/loading'
import ContactLoading from './contact/loading'
import FeedbacksLoading from './feedbacks/loading'
import GettingStartedLoading from './getting-started/loading'
import IdentityLoading from './identity/loading'
import IdentifiersLoading from './identificadores/loading'
import SettingsLoading from './settings/loading'
import TeamLoading from './team/loading'
import AccountProfileLoading from './account/profile/loading'
import AccountSettingsLoading from './account/settings/loading'

const restaurantRouteSkeletons = {
  '': <MenuLoading />,
  'service-calls': <CallsLoading />,
  contact: <ContactLoading />,
  feedbacks: <FeedbacksLoading />,
  'getting-started': <GettingStartedLoading />,
  identity: <IdentityLoading />,
  identificadores: <IdentifiersLoading />,
  settings: <SettingsLoading />,
  team: <TeamLoading />,
  'account/profile': <AccountProfileLoading />,
  'account/settings': <AccountSettingsLoading />,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { title: 'Painel' }
  const workspace = await getRestaurantWorkspace(parsed.data)
  return workspace
    ? { title: { template: `%s · ${workspace.restaurant.name} · Tavvi` } }
    : { title: 'Painel' }
}

  // Área segura do iPhone (dock e sheets) e cor da barra do
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

  // As consultas da casca rodam DENTRO do Suspense (doc do Next: layout.md,
  // "Interaction with loading.js"). Sem isso a navegação para um restaurante
  // travava até o layout terminar, sem esqueleto nenhum.
  return (
    <Suspense fallback={
      <ShellSkeleton surface="restaurant">
        <RestaurantRouteLoading skeletons={restaurantRouteSkeletons} />
      </ShellSkeleton>
    }>
      <RestaurantShell restaurantId={parsed.data}>{children}</RestaurantShell>
    </Suspense>
  )
}
