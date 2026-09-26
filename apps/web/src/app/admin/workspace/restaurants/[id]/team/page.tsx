import { notFound } from 'next/navigation'
import { InviteDialog } from '@/features/invitations/components/invite-dialog'
import { InviteList } from '@/features/invitations/components/invite-list'
import { MemberRow } from '@/features/workspace/components/member-row'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { RiTeamLine } from 'react-icons/ri'
import { PageHeader } from '@/components/shell/page-header'
import {
  MEMBER_ROLE_HINTS,
  MEMBER_ROLE_LABELS,
  type MemberRole,
} from '@/domain/invite'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  const pendentes = invites.filter(
    (invite) => inviteStatus(invite) === 'pendente',
  )

  return (
    <main className="tavvi-page">
      <PageHeader
        className="tv-page-header"
        eyebrow="Acessos"
        title="Equipe"
        description="Administradores editam o restaurante. Caixa, atendente e garçom consultam o cardápio e os preços."
        actions={<InviteDialog mode="team" restaurantId={restaurant.id} />}
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Papéis da equipe">
        {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => {
          const count = members.filter((member) => member.role === role).length
          return <article key={role} className="tavvi-surface p-4">
            <p className="text-sm font-semibold">{MEMBER_ROLE_LABELS[role]} <span className="ml-1 font-mono text-xs text-muted-foreground">{count}</span></p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{MEMBER_ROLE_HINTS[role]}</p>
            <span className="mt-3 inline-flex rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{role === 'admin' ? 'Edita' : 'Consulta'}</span>
          </article>
        })}
      </section>

      {members.length === 1 && pendentes.length === 0 ? <div className="mb-6">
        <PanelEmptyState
          density="section"
          icon={<RiTeamLine />}
          title="Só você por aqui"
          description="Convide alguém pelo botão no topo para ajudar a administrar ou consultar o cardápio."
        />
      </div> : null}

      <div className="tavvi-surface hidden overflow-hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/35">
            <TableHead>Pessoa</TableHead>
            <TableHead className="w-48">Papel</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <MemberRow key={member.membershipId} member={member} isSelf={member.userId === user.id} />
          ))}
        </TableBody>
      </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {members.map((member) => (
          <MemberRow key={member.membershipId} member={member} variant="card" isSelf={member.userId === user.id} />
        ))}
      </div>

      {pendentes.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold tracking-[-0.02em]">
            Convites pendentes
          </h2>
          {/* `showRole` aqui, e não no console: convite de equipe carrega
              papel, o de plataforma é sempre administrador. */}
          <InviteList invites={pendentes} showRole />
        </section>
      ) : null}
    </main>
  )
}
