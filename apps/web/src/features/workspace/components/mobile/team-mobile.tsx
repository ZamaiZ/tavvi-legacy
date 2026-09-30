'use client'

import { useState } from 'react'
import { LuChevronRight, LuMail, LuUserPlus } from 'react-icons/lu'
import { MEMBER_ROLE_LABELS, type InviteDTO, type MemberDTO } from '@/domain/invite'
import { formatLong } from '@/lib/format-date'
import { personInitials } from '@/lib/initials'
import { MemberSheet } from './member-sheet'
import { PendingInviteSheet } from './pending-invite-sheet'
import { TeamInviteSheet } from './team-invite-sheet'

// Equipe no celular (Tavvi Mobile.dc.html, bTeam): título com "Convidar",
// a frase dos papéis e a lista agrupada. Tocar num membro abre o sheet do
// membro; convites pendentes vêm num segundo grupo.
export function TeamMobile({
  restaurantId,
  restaurantName,
  members,
  invites,
  currentUserId,
}: {
  restaurantId: string
  restaurantName: string
  members: MemberDTO[]
  /** Só os pendentes. */
  invites: InviteDTO[]
  currentUserId: string
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState(false)
  const member = members.find((entry) => entry.membershipId === memberId) ?? null
  const pendingInvite = invites.find((entry) => entry.id === pendingId) ?? null

  return (
    <div className="tv-mp">
      <div className="tv-mp-titlebar">
        <h1 className="tv-mp-title">Equipe</h1>
        <button type="button" className="tv-mp-action" aria-haspopup="dialog" onClick={() => setInviteOpen(true)}>
          <LuUserPlus aria-hidden="true" />Convidar
        </button>
      </div>
      <p className="tv-mp-lead is-team">Administradores editam o restaurante. Caixa, atendente e garçom consultam o cardápio e os preços.</p>

      <div className="tv-group">
        {members.map((entry) => {
          const primary = entry.displayName ?? entry.email ?? 'Sem identificação'
          const secondary = entry.displayName && entry.email ? entry.email : null
          return (
            <button
              key={entry.membershipId}
              type="button"
              className="tv-mmember"
              aria-haspopup="dialog"
              onClick={() => {
                setMemberId(entry.membershipId)
                setMemberOpen(true)
              }}
            >
              <span className="tv-mavatar" aria-hidden="true">{personInitials(entry)}</span>
              <span className="tv-mmember-body">
                <span className="tv-mmember-copy">
                  <strong>{primary}</strong>
                  {secondary ? <small>{secondary}</small> : null}
                </span>
                <span className="tv-mmember-role">{MEMBER_ROLE_LABELS[entry.role]}</span>
                <LuChevronRight aria-hidden="true" />
              </span>
            </button>
          )
        })}
      </div>

      {members.length === 1 && invites.length === 0 ? (
        <div className="tv-mteam-alone">
          <strong>Só você por aqui</strong>
          <span>Convide alguém pelo botão Convidar para ajudar a administrar ou consultar o cardápio.</span>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <>
          <h2 className="tv-group-label">Convites pendentes</h2>
          <div className="tv-group">
            {invites.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="tv-mmember"
                aria-haspopup="dialog"
                onClick={() => {
                  setPendingId(entry.id)
                  setPendingOpen(true)
                }}
              >
                <span className="tv-minvite-icon" aria-hidden="true"><LuMail /></span>
                <span className="tv-mmember-body">
                  <span className="tv-mmember-copy">
                    <strong>{entry.email ?? 'Qualquer e-mail'}</strong>
                    <small>{MEMBER_ROLE_LABELS[entry.role]} · Válido até {formatLong(entry.expiresAt)}</small>
                  </span>
                  <LuChevronRight aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <TeamInviteSheet restaurantId={restaurantId} restaurantName={restaurantName} open={inviteOpen} onOpenChange={setInviteOpen} />
      {member ? <MemberSheet member={member} isSelf={member.userId === currentUserId} open={memberOpen} onOpenChange={setMemberOpen} /> : null}
      {pendingInvite ? <PendingInviteSheet invite={pendingInvite} open={pendingOpen} onOpenChange={setPendingOpen} /> : null}
    </div>
  )
}
