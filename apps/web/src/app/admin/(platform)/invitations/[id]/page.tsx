import { notFound } from 'next/navigation'
import { InviteDetail } from '@/features/platform/components/invites/invite-detail'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { uuidSchema } from '@/domain/common'
import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getCachedPlatformInvite } from '@/server/dal/admin-console'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdminPage()
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()
  const invite = await getCachedPlatformInvite(parsed.data)
  if (!invite) notFound()
  return <main className="tv-detail-page">
    <MobileNavBar backHref="/" backLabel="Convites" title="Convite" />
    <div className="tv-detail-page-content"><header><span>CONVITE</span><h1>Detalhes do convite<i>.</i></h1></header><InviteDetail invite={invite} /></div>
  </main>
}
