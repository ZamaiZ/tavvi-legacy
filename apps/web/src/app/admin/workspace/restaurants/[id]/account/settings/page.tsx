import { SettingsPage } from '@/features/account/components/settings-page'

export const metadata = { title: 'Configurações' }

export default async function RestaurantAccountSettingsPage() {
  return <SettingsPage showSessions={false} />
}
