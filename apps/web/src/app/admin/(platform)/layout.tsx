import { cookies } from 'next/headers'
import { ConsoleShell } from '@/components/shell/console-shell'
import { getConsoleConfig } from '@/components/shell/console-config'
import { PlatformInviteOverlay } from '@/features/platform/components/invites/platform-invite-overlay'
import { getCurrentUser, getPlatformAdminStatus } from '@/server/dal/auth'
import { getCachedAdminRestaurants, getCachedPlatformInvites } from '@/server/dal/admin-console'
import { inviteState } from '@/domain/invite'
import { PlatformAppearanceProvider } from '@/components/theme/platform-appearance-provider'
import { readPlatformAppearance } from '@/server/api/platform-appearance'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const appearance = await readPlatformAppearance()
  // This layout also wraps the sign-in page, so authorization stays in the
  // private pages and the existing access-denied decision remains unchanged.
  const user = await getCurrentUser()
  if (!user || (await getPlatformAdminStatus()) === 'denied') {
    return <PlatformAppearanceProvider initialAppearance={appearance} className="admin-territory flex min-h-dvh flex-col">{children}</PlatformAppearanceProvider>
  }

  const cookieStore = await cookies()
  const initialRail = cookieStore.get('tv_rail')?.value === 'pinned' ? 'pinned' : 'collapsed'
  const config = getConsoleConfig(user)
  const [invites, restaurants] = await Promise.all([getCachedPlatformInvites(), getCachedAdminRestaurants()])
  const pendingCount = invites.filter((invite) => inviteState(invite) === 'pending').length
  const consoleConfig = { ...config, counts: { pendingInvites: pendingCount, restaurants: restaurants.length } }
  return (
    <PlatformAppearanceProvider initialAppearance={appearance} className="admin-territory min-h-dvh">
      <ConsoleShell config={consoleConfig} initialRail={initialRail} inviteOverlay={<PlatformInviteOverlay />}>
        {children}
      </ConsoleShell>
    </PlatformAppearanceProvider>
  )
}
