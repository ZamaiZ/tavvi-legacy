'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LuBan, LuCircleCheck, LuClock3, LuChevronRight, LuCopy, LuMail, LuPanelRightOpen, LuRotateCcw } from 'react-icons/lu'
import { inviteState, type InviteState, type PlatformInviteDTO } from '@/domain/invite'
import { formatLong, formatShort } from '@/lib/format-date'
import { copyText } from '@/lib/copy-text'
import { isMobileViewport, markStackedFromList } from '@/lib/viewport'
import { revokeInviteAction } from '@/server/actions/invites'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { toast } from '@/components/ui/toast'
import { useConsoleActions } from '@/components/shell/console-shell'
import { ListHero, NewInviteButton } from '../list-hero'
import { Toolbar, type InviteFilter } from '../toolbar'
import { TvBadge } from '../tv-badge'
import { ConfirmDialog } from '../confirm-dialog'
import { StateCard } from '../state-card'
import { useLocalSelection } from '../use-detail-selection'
import { InviteDrawer } from './invite-drawer'
import { InvitesMobileHeader } from './invites-mobile-header'

const filters: InviteFilter[] = ['all', 'pending', 'redeemed', 'expired', 'revoked']

function inviteMeta(invite: PlatformInviteDTO, state: InviteState) {
  if (state === 'pending') return `Válido até ${formatLong(invite.expiresAt)}`
  if (state === 'redeemed') return `Resgatado em ${formatLong(invite.redeemedAt!)}`
  if (state === 'revoked') return `Revogado em ${formatLong(invite.revokedAt!)}`
  return `Venceu em ${formatLong(invite.expiresAt)}`
}

function updateFilter(router: ReturnType<typeof useRouter>, search: ReturnType<typeof useSearchParams>, filter: InviteFilter) {
  const params = new URLSearchParams(search.toString())
  if (filter === 'all') params.delete('situacao')
  else params.set('situacao', filter)
  const value = params.toString()
  router.replace(`/${value ? `?${value}` : ''}`, { scroll: false })
}

export function InviteList({ invites, query, filter, selectedId }: {
  invites: PlatformInviteDTO[]
  query: string
  filter: InviteFilter
  selectedId: string | null
}) {
  const router = useRouter()
  const search = useSearchParams()
  const { openInvite } = useConsoleActions()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [openId, selectInvite] = useLocalSelection('convite', selectedId)
  const openRecord = openId ? invites.find((invite) => invite.id === openId) ?? null : null
  const counts = useMemo(() => Object.fromEntries(filters.map((key) => [key, key === 'all' ? invites.length : invites.filter((invite) => inviteState(invite) === key).length])) as Partial<Record<InviteFilter, number>>, [invites])
  const filtered = useMemo(() => invites.filter((invite) => {
    const matchesQuery = !query || (invite.email ?? 'Qualquer e-mail').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
    return matchesQuery && (filter === 'all' || inviteState(invite) === filter)
  }), [filter, invites, query])
  const pendingCount = counts.pending ?? 0

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeInviteAction(id)
      setConfirmId(null)
      toast.add(result.ok ? { title: 'Convite revogado', type: 'success' } : { title: 'Não foi possível revogar o convite.', type: 'error' })
      router.refresh()
    })
  }

  // No celular o detalhe é uma tela empilhada (/convites/[id]), como no app;
  // no desktop o drawer abre na hora com o registro que a lista já tem.
  function showInvite(id: string) {
    if (isMobileViewport()) {
      markStackedFromList(`/convites/${id}`)
      router.push(`/convites/${id}`)
    } else selectInvite(id)
  }

  // ?convite= com id fora da lista só limpa a URL; aberto no celular, vai
  // direto para a tela empilhada.
  useEffect(() => {
    if (!openId) return
    if (!openRecord) selectInvite(null)
    else if (isMobileViewport()) router.replace(`/convites/${openId}`, { scroll: false })
  }, [openId, openRecord, router, selectInvite])

  return <div className="tv-console-page">
    <InvitesMobileHeader pending={pendingCount} total={invites.length} onCreate={() => openInvite()} />
    <ListHero
      title="Convites"
      description="Crie acessos seguros para que novos clientes cadastrem e administrem seus restaurantes."
      hero={{
        label: 'Aguardando resgate',
        chip: 'Plataforma',
        value: pendingCount,
        detail: `${pendingCount === 1 ? 'pendente' : 'pendentes'} de ${invites.length} ${invites.length === 1 ? 'convite emitido' : 'convites emitidos'}`,
        actions: <>
          <NewInviteButton onClick={() => openInvite()} />
          <button type="button" className="tv-hero-button is-ink" onClick={() => updateFilter(router, search, 'pending')}>Ver pendentes</button>
        </>,
      }}
      stats={[
        { label: 'Resgatados', value: counts.redeemed ?? 0, icon: <LuCircleCheck aria-hidden="true" />, onClick: () => updateFilter(router, search, 'redeemed') },
        { label: 'Vencidos', value: counts.expired ?? 0, icon: <LuClock3 aria-hidden="true" />, onClick: () => updateFilter(router, search, 'expired') },
        { label: 'Revogados', value: counts.revoked ?? 0, icon: <LuBan aria-hidden="true" />, onClick: () => updateFilter(router, search, 'revoked') },
      ]}
    />
    <Toolbar kind="invites" query={query} filter={filter} counts={counts} />
    {invites.length === 0 ? <StateCard icon={<LuMail />} title="Nenhum convite ainda" description="Emita o primeiro. Quem receber cria a conta, cria o restaurante e já entra como administrador dele." /> : filtered.length === 0 ? <>
      <div className="tv-no-results tv-d-only" aria-live="polite">{query ? `Nenhum convite encontrado para “${query}”.` : 'Nenhum convite nesta situação.'}</div>
      <div className="tv-m-empty tv-m-only" aria-live="polite"><strong>Nada encontrado</strong><span>Ajuste a busca ou o filtro para ver outros resultados.</span></div>
    </> : <>
      <div role="table" aria-label="Convites" className="tv-table-shell">
        <div role="row" className="tv-table-head tv-invite-columns">
          <span role="columnheader">Destinatário</span>
          <span role="columnheader">Situação</span>
          <span role="columnheader">Criado em</span>
          <span role="columnheader">Válido até</span>
          <span role="columnheader"><span className="sr-only">Ações</span></span>
        </div>
        {filtered.map((invite) => {
          const state = inviteState(invite)
          const title = invite.email ?? 'Qualquer e-mail'
          const rotateLabel = state === 'pending' ? 'Gerar novo link' : 'Gerar novo convite'
          return <ContextMenu key={invite.id}>
            <ContextMenuTrigger render={<div role="row" className={`tv-table-row tv-invite-columns${openId === invite.id ? ' is-selected' : ''}`} />}>
              <button type="button" className="tv-row-hit" aria-label={`Abrir convite para ${invite.email ?? 'qualquer e-mail'}`} onClick={() => showInvite(invite.id)} />
              <div role="cell" className="tv-table-cell">
                <span className="tv-row-icon"><LuMail aria-hidden="true" /></span>
                <span className="tv-row-copy"><strong className="tv-row-title">{title}</strong><small className="tv-row-meta">{inviteMeta(invite, state)}</small></span>
              </div>
              <div role="cell"><TvBadge state={state} /></div>
              <div role="cell" className="tv-date-cell">{formatShort(invite.createdAt)}</div>
              <div role="cell" className="tv-date-cell">{formatShort(invite.expiresAt)}</div>
              <div role="cell" className="tv-row-actions">
                {state === 'pending' ? <button type="button" className="is-danger" aria-label="Revogar convite" title="Revogar convite" onClick={() => setConfirmId(invite.id)}><LuBan aria-hidden="true" /></button> : null}
                <button type="button" aria-label={rotateLabel} title={rotateLabel} onClick={() => openInvite(invite.email ?? undefined, state === 'pending' ? invite.id : undefined)}><LuRotateCcw aria-hidden="true" /></button>
                <LuChevronRight className="tv-row-chevron" aria-hidden="true" />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent aria-label={`Ações do convite para ${title}`}>
              <ContextMenuItem onClick={() => showInvite(invite.id)}><LuPanelRightOpen aria-hidden="true" /><span>Abrir</span></ContextMenuItem>
              {invite.email ? <ContextMenuItem onClick={() => void copyText(invite.email!, 'E-mail copiado')}><LuCopy aria-hidden="true" /><span>Copiar e-mail</span></ContextMenuItem> : null}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => openInvite(invite.email ?? undefined, state === 'pending' ? invite.id : undefined)}><LuRotateCcw aria-hidden="true" /><span>{rotateLabel}</span></ContextMenuItem>
              {state === 'pending' ? <ContextMenuItem variant="destructive" onClick={() => setConfirmId(invite.id)}><LuBan aria-hidden="true" /><span>Revogar convite</span></ContextMenuItem> : null}
            </ContextMenuContent>
          </ContextMenu>
        })}
      </div>
      <div className="tv-mobile-cards">{filtered.map((invite) => { const state = inviteState(invite); return <button type="button" key={invite.id} className="tv-mobile-card" onClick={() => showInvite(invite.id)}><span className="tv-row-icon"><LuMail /></span><span className="tv-mobile-card-copy"><strong>{invite.email ?? 'Qualquer e-mail'}</strong><small>{inviteMeta(invite, state)}</small></span><TvBadge state={state} /><LuChevronRight className="tv-row-chevron" /></button> })}</div>
    </>}
    <InviteDrawer invite={openRecord} onClose={() => selectInvite(null)} />
    {confirmId && <ConfirmDialog title="Revogar convite?" description="O link deixará de funcionar imediatamente." confirmLabel="Revogar" icon={<LuBan />} destructive pending={pending} onCancel={() => setConfirmId(null)} onConfirm={() => revoke(confirmId)} />}
  </div>
}
