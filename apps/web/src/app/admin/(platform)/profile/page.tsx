import { ProfilePage } from '@/features/account/components/profile-page'
import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getAccountProfile } from '@/server/dal/profile'

export const metadata = { title: 'Perfil' }

export default async function PlatformProfilePage() {
  await requirePlatformAdminPage()
  const profile = await getAccountProfile()
  return <ProfilePage profile={profile} />
}
