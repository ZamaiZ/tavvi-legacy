import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getCachedPlatformInvite, getCachedPlatformInvites } from '@/server/dal/admin-console'
import { uuidSchema } from '@/domain/common'
import { InviteList } from '@/features/platform/components/invites/invite-table'
import type { InviteFilter } from '@/features/platform/components/toolbar'

export const metadata = { title: 'Convites' }
const filters = new Set<InviteFilter>(['all', 'pending', 'redeemed', 'expired', 'revoked'])

export default async function Page({ searchParams }: {
  searchParams: Promise<{ convite?: string | string[]; q?: string | string[]; situacao?: string | string[] }>
}) {
  await requirePlatformAdminPage()
  const params = await searchParams
  const [invites, inviteId] = [await getCachedPlatformInvites(), typeof params.convite === 'string' ? params.convite : null]
  const parsedId = inviteId ? uuidSchema.safeParse(inviteId) : null
  const selectedInvite = parsedId?.success ? await getCachedPlatformInvite(parsedId.data) : null
  const rawFilter = typeof params.situacao === 'string' ? params.situacao as InviteFilter : 'all'
  return <InviteList
    invites={invites}
    query={typeof params.q === 'string' ? params.q : ''}
    filter={filters.has(rawFilter) ? rawFilter : 'all'}
    selectedId={selectedInvite?.id}
    selectedInvite={selectedInvite}
    invalidDetail={Boolean(inviteId && (!parsedId?.success || !selectedInvite))}
  />
}
