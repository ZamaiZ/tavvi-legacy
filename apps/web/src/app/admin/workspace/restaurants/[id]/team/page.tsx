import { notFound } from 'next/navigation'
import { LuUsers } from 'react-icons/lu'
import { InviteDialog } from '@/features/invitations/components/invite-dialog'
import { InviteList } from '@/features/invitations/components/invite-list'
import { MemberRow } from '@/features/workspace/components/member-row'
import { TeamMobile } from '@/features/workspace/components/mobile/team-mobile'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { PageHeader } from '@/components/shell/page-header'
import {
  MEMBER_ROLE_HINTS,
  MEMBER_ROLE_LABELS,
  type MemberRole,
} from '@/domain/invite'
import { uuidSchema } from '@/domain/common'
import { inviteStatus } from '@/domain/invite'
import { requireRestaurantAdmin, requireUser } from '@/server/dal/auth'
import { listInvites } from '@/server/dal/invites'
import { listMembers } from '@/server/dal/members'
import { getRestaurantWorkspace } from '@/server/dal/restaurant-workspace'

export const metadata = { title: 'Equipe' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) notFound()

  const workspace = await getRestaurantWorkspace(parsed.data)
  if (!workspace) notFound()
  const { restaurant } = workspace
  const user = await requireUser()
  await requireRestaurantAdmin(restaurant.id)

  // As duas consultas são independentes: buscar em paralelo evita somar as
  // latências.
  const [members, invites] = await Promise.all([
    listMembers(restaurant.id),
    listInvites(restaurant.id),
  ])

  const pendingInvites = invites.filter(
    (invite) => inviteStatus(invite) === 'pending',
  )

  return (
    <>
    <main className="tv-team-page tv-d-only">
      <PageHeader
        eyebrow="Acessos"
        title="Equipe"
        description="Administradores editam o restaurante. Caixa, atendente e garçom consultam o cardápio e os preços."
        actions={<InviteDialog restaurantId={restaurant.id} restaurantName={restaurant.name} />}
      />

      <div className="tv-team-body">
        <section className="tv-team-roles" aria-label="Papéis da equipe">
          {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => {
            const count = members.filter((member) => member.role === role).length
            return (
              <article key={role} className="tv-team-role">
                <div className="tv-team-role-head">
                  <strong>{MEMBER_ROLE_LABELS[role]}</strong>
                  <span>{count}</span>
                </div>
                <p>{MEMBER_ROLE_HINTS[role]}</p>
                <span className={`tv-team-tag${role === 'admin' ? ' is-edit' : ''}`}>
                  {role === 'admin' ? 'Edita' : 'Consulta'}
                </span>
              </article>
            )
          })}
        </section>

        {members.length === 1 && pendingInvites.length === 0 ? (
          <PanelEmptyState
            density="section"
            icon={<LuUsers />}
            title="Só você por aqui"
            description="Convide alguém pelo botão no topo para ajudar a administrar ou consultar o cardápio."
          />
        ) : null}

        <div role="table" aria-label="Membros da equipe" className="tv-table-shell hidden md:block">
          <div role="row" className="tv-table-head tv-team-columns">
            <span role="columnheader">Pessoa</span>
            <span role="columnheader">Papel</span>
            <span role="columnheader">Desde</span>
            <span role="columnheader"><span className="sr-only">Ações</span></span>
          </div>
          {members.map((member) => (
            <MemberRow key={member.membershipId} member={member} isSelf={member.userId === user.id} />
          ))}
        </div>

        {pendingInvites.length > 0 ? (
          <section className="tv-team-invites" aria-labelledby="tv-team-invites-title">
            <h2 id="tv-team-invites-title">Convites pendentes</h2>
            <InviteList invites={pendingInvites} />
          </section>
        ) : null}
      </div>
    </main>
    <div className="tv-m-only">
      <TeamMobile
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        members={members}
        invites={pendingInvites}
        currentUserId={user.id}
      />
    </div>
    </>
  )
}
