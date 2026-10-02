import { SettingsPage } from '@/features/account/components/settings-page'
import { requirePlatformAdminPage } from '@/server/dal/auth'

export const metadata = { title: 'Configurações' }

export default async function PlatformSettingsPage() {
  await requirePlatformAdminPage()
  return <SettingsPage showSessions />
}
