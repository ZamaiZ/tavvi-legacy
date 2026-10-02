import { ProfilePage } from '@/features/account/components/profile-page'
import { getAccountProfile } from '@/server/dal/profile'

export const metadata = { title: 'Perfil' }

export default async function RestaurantAccountProfilePage() {
  const profile = await getAccountProfile()
  return <ProfilePage profile={profile} />
}
