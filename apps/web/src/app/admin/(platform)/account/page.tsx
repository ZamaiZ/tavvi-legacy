import { AccountView } from '@/features/platform/components/account/account-view'
import { requirePlatformAdminPage } from '@/server/dal/auth'

export const metadata = { title: 'Conta' }

export default async function Page() {
  const user = await requirePlatformAdminPage()
  return <AccountView email={user.email} />
}
