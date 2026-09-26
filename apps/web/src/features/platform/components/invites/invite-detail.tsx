'use client'

import { useState, useTransition } from 'react'
import { LuBan, LuCheck, LuMail, LuRotateCcw } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import { inviteState, type PlatformInviteDTO } from '@/domain/invite'
import { formatLong } from '@/lib/format-date'
import { revokeInviteAction } from '@/server/actions/invites'
import { TvBadge } from '../tv-badge'
import { PrimaryCTA, TonalButton } from '../buttons'
import { useConsoleActions } from '@/components/shell/console-shell'

function meta(invite: PlatformInviteDTO, state: ReturnType<typeof inviteState>) {
  if (state === 'pending') return `Válido até ${formatLong(invite.expiresAt)}`
  if (state === 'redeemed') return `Resgatado em ${formatLong(invite.redeemedAt!)}`
  if (state === 'revoked') return `Revogado em ${formatLong(invite.revokedAt!)}`
  return `Venceu em ${formatLong(invite.expiresAt)}`
}

export function InviteDetail({ invite }: { invite: PlatformInviteDTO }) {
  const state = inviteState(invite)
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const { openInvite } = useConsoleActions()
  const title = invite.email ?? 'Qualquer e-mail'
  const events = [
    { label: 'Criado', meta: `${formatLong(invite.createdAt)} · por ${invite.createdByEmail}`, tone: 'neutral' },
    ...(invite.redeemedAt ? [{ label: 'Resgatado', meta: `${formatLong(invite.redeemedAt)} · ${invite.redeemedByEmail ?? invite.email ?? 'Administrador'}`, tone: 'ok' }] : []),
    ...(invite.revokedAt ? [{ label: 'Revogado', meta: formatLong(invite.revokedAt), tone: 'danger' }] : []),
    ...(!invite.revokedAt && !invite.redeemedAt && Date.parse(invite.expiresAt) <= Date.now() ? [{ label: 'Venceu', meta: formatLong(invite.expiresAt), tone: 'warn' }] : []),
    ...(state === 'pending' ? [{ label: 'Aguardando resgate', meta: `Válido até ${formatLong(invite.expiresAt)}`, tone: 'accent' }] : []),
  ]
  function revoke() {
    startTransition(async () => {
      const result = await revokeInviteAction(invite.id)
      setConfirm(false)
      toast.add(result.ok ? { title: 'Convite revogado', type: 'success' } : { title: 'Não foi possível revogar o convite.', type: 'error' })
    })
  }
  return <div className="tv-detail-stack">
    <section className="tv-detail-hero tv-invite-detail-hero">
      <div className="tv-detail-top"><span className="tv-detail-icon"><LuMail /></span><TvBadge state={state} hero /></div>
      <h2>{title}<i>.</i></h2><p>{meta(invite, state)}</p>
    </section>
    <section className="tv-info-card"><div><span>Criado em</span><strong>{formatLong(invite.createdAt)}</strong></div><div><span>Válido até</span><strong>{formatLong(invite.expiresAt)}</strong></div><div><span>Destinatário</span><strong>{invite.email ? 'E-mail definido' : 'Qualquer e-mail'}</strong></div></section>
    <section className="tv-timeline-card"><h3>HISTÓRICO</h3>{events.map((event) => <div className={`tv-timeline-event tv-event-${event.tone}`} key={event.label}><span className="tv-timeline-dot"><i /></span><div><strong>{event.label}</strong><small>{event.meta}</small></div></div>)}</section>
    {state === 'pending' ? <>
      <PrimaryCTA className="tv-detail-primary" onClick={() => openInvite(invite.email ?? undefined, invite.id)}>Gerar novo link<span><LuRotateCcw /></span></PrimaryCTA>
      <TonalButton className="tv-detail-revoke" onClick={() => setConfirm(true)}><LuBan />Revogar convite</TonalButton>
    </> : <button type="button" className="tv-secondary-cta tv-detail-secondary" onClick={() => openInvite(invite.email ?? undefined)}><span>Gerar novo convite</span><i><LuRotateCcw /></i></button>}
    {confirm && <div className="tv-confirm-scrim"><section role="alertdialog" aria-modal="true" aria-label="Revogar convite?" className="tv-confirm-dialog"><span className="tv-state-icon is-danger"><LuBan /></span><h2>Revogar convite?</h2><p>O link deixará de funcionar imediatamente.</p><div><button type="button" className="tv-secondary-cta" onClick={() => setConfirm(false)}>Cancelar</button><button type="button" className="tv-tonal-button" disabled={pending} onClick={revoke}>{pending ? <span className="tv-spinner" /> : 'Revogar'}</button></div></section></div>}
  </div>
}
