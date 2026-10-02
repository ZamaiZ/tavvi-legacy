import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getConsoleConfig } from '@/components/shell/console-config'
import { ShellSkeleton } from '@/components/shell/shell-skeleton'
import { ConsoleListSkeleton } from '@/features/platform/components/console-list-skeleton'
import { PlatformInviteOverlay } from '@/features/platform/components/invites/platform-invite-overlay'
import { ConsoleAccountSheet } from '@/features/platform/components/account/account-sheet'
import { getCurrentUser, getPlatformAdminStatus } from '@/server/dal/auth'
import { getCachedAdminRestaurants, getCachedPlatformInvites } from '@/server/dal/admin-console'
import { countUnreadNotificationsSafe } from '@/server/dal/notifications'
import { getMyDisplayName } from '@/server/dal/profile'
import { inviteState } from '@/domain/invite'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { pwaMetadata } from '@/lib/pwa'
import { env } from '@/server/env'

// Área segura do iPhone (tab bar e sheet) e cor da barra do navegador igual
// ao fundo agrupado do console no celular.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F0EB' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0C0A' },
  ],
}

// Instalável como "Tavvi Console": meta tags do iOS aqui, manifesto pelo
// PwaProvider. Vale também no login, que este layout envolve.
export const metadata: Metadata = pwaMetadata('admin')

// A casca do console com os dados dela (contagens, nome). Vive dentro do
// <Suspense> do layout (doc do Next: layout.md, "Interaction with
// loading.js"): a navegação mostra o esqueleto em vez de travar.
async function PlatformShell({ user, children }: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'
  const [invites, restaurants, displayName, unreadNotifications] = await Promise.all([
    getCachedPlatformInvites(),
    getCachedAdminRestaurants(),
    getMyDisplayName(),
    countUnreadNotificationsSafe(),
  ])
  const config = getConsoleConfig(user, displayName)
  const pendingCount = invites.filter((invite) => inviteState(invite) === 'pending').length
  const consoleConfig = { ...config, counts: { pendingInvites: pendingCount, restaurants: restaurants.length, unreadNotifications } }
  return (
    <ConsoleShell surface="console" config={consoleConfig} initialRail={initialRail} inviteOverlay={<PlatformInviteOverlay />} accountSheet={<ConsoleAccountSheet />}>
      {children}
    </ConsoleShell>
  )
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This layout also wraps the sign-in page, so authorization stays in the
  // private pages and the existing access-denied decision remains unchanged.
  // A checagem fica antes do Suspense: ela decide se há casca.
  const user = await getCurrentUser()
  if (!user || (await getPlatformAdminStatus()) === 'denied') {
    return (
      <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
        <div className="admin-territory flex min-h-dvh flex-col">{children}</div>
      </PwaProvider>
    )
  }

  return (
    <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
      <div className="admin-territory min-h-dvh">
        <Suspense fallback={<ShellSkeleton><ConsoleListSkeleton /></ShellSkeleton>}>
          <PlatformShell user={user}>{children}</PlatformShell>
        </Suspense>
      </div>
    </PwaProvider>
  )
}
