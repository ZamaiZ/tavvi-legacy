import { requirePlatformAdminPage } from '@/server/dal/auth'
import { getCachedPlatformInvites } from '@/server/dal/admin-console'
import { InviteList } from '@/features/platform/components/invites/invite-table'
import type { InviteFilter } from '@/features/platform/components/toolbar'

export const metadata = { title: 'Convites' }
const filters = new Set<InviteFilter>(['all', 'pending', 'redeemed', 'expired', 'revoked'])

// O detalhe do convite sai da própria lista (mesmo DTO); ?convite= só diz
// qual drawer abrir.
export default async function Page({ searchParams }: {
  searchParams: Promise<{ convite?: string | string[]; q?: string | string[]; situacao?: string | string[] }>
}) {
  await requirePlatformAdminPage()
  const params = await searchParams
  const invites = await getCachedPlatformInvites()
  const rawFilter = typeof params.situacao === 'string' ? params.situacao as InviteFilter : 'all'
  return <InviteList
    invites={invites}
    query={typeof params.q === 'string' ? params.q : ''}
    filter={filters.has(rawFilter) ? rawFilter : 'all'}
    selectedId={typeof params.convite === 'string' ? params.convite : null}
  />
}
