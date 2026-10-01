import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getConsoleConfig } from '@/components/shell/console-config'
import { PlatformInviteOverlay } from '@/features/platform/components/invites/platform-invite-overlay'
import { ConsoleAccountSheet } from '@/features/platform/components/account/account-sheet'
import { getCurrentUser, getPlatformAdminStatus } from '@/server/dal/auth'
import { getCachedAdminRestaurants, getCachedPlatformInvites } from '@/server/dal/admin-console'
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This layout also wraps the sign-in page, so authorization stays in the
  // private pages and the existing access-denied decision remains unchanged.
  const user = await getCurrentUser()
  if (!user || (await getPlatformAdminStatus()) === 'denied') {
    return (
      <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
        <div className="admin-territory flex min-h-dvh flex-col">{children}</div>
      </PwaProvider>
    )
  }

  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'
  const config = getConsoleConfig(user)
  const [invites, restaurants] = await Promise.all([getCachedPlatformInvites(), getCachedAdminRestaurants()])
  const pendingCount = invites.filter((invite) => inviteState(invite) === 'pending').length
  const consoleConfig = { ...config, counts: { pendingInvites: pendingCount, restaurants: restaurants.length } }
  return (
    <PwaProvider vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}>
      <div className="admin-territory min-h-dvh">
        <ConsoleShell surface="console" config={consoleConfig} initialRail={initialRail} inviteOverlay={<PlatformInviteOverlay />} accountSheet={<ConsoleAccountSheet />}>
          {children}
        </ConsoleShell>
      </div>
    </PwaProvider>
  )
}
