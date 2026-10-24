'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { LuArrowDownLeft, LuArrowLeft, LuCheck, LuPrinter, LuSettings2 } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import type { CheckoutSettingsDTO, TableAccountDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  decideTipAndCloseAction,
  getCheckoutSettingsAction,
  listCashAccountsAction,
  reopenTableAccountAction,
} from '@/server/actions/table-accounts'
import { useTableAccountsRealtime } from '../use-table-accounts-realtime'
import { PaymentEntry } from './payment-entry'
import { CashSettings } from './cash-settings'
import { PreAccount } from './pre-account'
import { AccountCorrections } from './account-corrections'

export function CashScreen({
  restaurantId,
  restaurantName,
  role,
  initialActive,
  initialRecentClosed,
  initialSettings,
}: {
  restaurantId: string
  restaurantName: string
  role: MemberRole
  initialActive: TableAccountDTO[]
  initialRecentClosed: TableAccountDTO[]
  initialSettings: CheckoutSettingsDTO
}) {
  const mobile = useIsMobile()
  const [active, setActive] = useState(initialActive)
  const [recentClosed, setRecentClosed] = useState(initialRecentClosed)
  const [settings, setSettings] = useState(initialSettings)
  const [selectedId, setSelectedId] = useState(initialActive[0]?.accountId ?? initialRecentClosed[0]?.accountId ?? null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileAccountsOpen, setMobileAccountsOpen] = useState(true)
  const [showTipDecision, setShowTipDecision] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenOpen, setReopenOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, startTransition] = useTransition()
  const settlementRequestIds = useRef(new Map<string, string>())
  const refreshRevision = useRef(0)

  const selected = active.find((account) => account.accountId === selectedId)
    ?? recentClosed.find((account) => account.accountId === selectedId)
    ?? null
  const showMobileAccounts = mobile && (mobileAccountsOpen || !selected)
  const methods = settings.paymentMethods.filter((method) => method.isActive)

  const refresh = useCallback(async () => {
    const revision = ++refreshRevision.current
    setRefreshing(true)
    try {
      const [result, settingsResult] = await Promise.all([
        listCashAccountsAction(restaurantId),
        getCheckoutSettingsAction(restaurantId),
      ])
      if (revision !== refreshRevision.current) return
      if (!result.ok) { setError(result.error); return }
      if (settingsResult.ok) setSettings(settingsResult.data)
      setError(settingsResult.ok ? null : settingsResult.error)
      setActive(result.data.active)
      setRecentClosed(result.data.recentClosed)
      setSelectedId((currentId) => currentId
        && (result.data.active.some((account) => account.accountId === currentId)
          || result.data.recentClosed.some((account) => account.accountId === currentId))
        ? currentId
        : result.data.active[0]?.accountId ?? result.data.recentClosed[0]?.accountId ?? null)
    } catch {
      if (revision === refreshRevision.current) setError('Não foi possível atualizar as comandas agora.')
    } finally {
      if (revision === refreshRevision.current) setRefreshing(false)
    }
  }, [restaurantId])
  const realtimeStatus = useTableAccountsRealtime(restaurantId, refresh)

  function applyAccount(account: TableAccountDTO) {
    refreshRevision.current++
    setRefreshing(false)
    setActive((current) => account.status === 'closed'
      ? current.filter((item) => item.accountId !== account.accountId)
      : [account, ...current.filter((item) => item.accountId !== account.accountId)].sort((a, b) => a.tableNumber - b.tableNumber))
    setRecentClosed((current) => account.status === 'closed'
      ? [account, ...current.filter((item) => item.accountId !== account.accountId)].slice(0, 25)
      : current.filter((item) => item.accountId !== account.accountId))
    setSelectedId(account.accountId)
    setShowTipDecision(false)
    setReopenOpen(false)
    setReopenReason('')
    setError(null)
  }

  function selectAccount(accountId: string) {
    setSelectedId(accountId)
    setMobileAccountsOpen(false)
    setShowTipDecision(false)
  }

  function decideTip(accepted: boolean) {
    if (!selected || busy) return
    setError(null)
    const key = `${selected.accountId}:${accepted}`
    const requestId = settlementRequestIds.current.get(key) ?? crypto.randomUUID()
    settlementRequestIds.current.set(key, requestId)
    startTransition(async () => {
      try {
        const result = await decideTipAndCloseAction({
          restaurantId, accountId: selected.accountId, tipAccepted: accepted, requestId,
        })
        if (!result.ok) { setError(result.error); return }
        settlementRequestIds.current.delete(key)
        applyAccount(result.data)
      } catch {
        setError('Não foi possível iniciar o fechamento. Atualize a comanda e confira o saldo.')
      }
    })
  }

  function reopen() {
    if (!selected || busy || !reopenReason.trim()) return
    const key = `${selected.accountId}:reopen:${reopenReason.trim()}`
    const requestId = settlementRequestIds.current.get(key) ?? crypto.randomUUID()
    settlementRequestIds.current.set(key, requestId)
    startTransition(async () => {
      try {
        const result = await reopenTableAccountAction({
          restaurantId, accountId: selected.accountId, reason: reopenReason.trim(), requestId,
        })
        if (!result.ok) { setError(result.error); return }
        settlementRequestIds.current.delete(key)
        applyAccount(result.data)
      } catch {
        setError('Não foi possível confirmar a reabertura. Tente novamente com o mesmo motivo.')
      }
    })
  }

  const selectedSummary = useMemo(() => selected ? {
    subtotal: selected.subtotalCents,
    tip: selected.tipCents,
    paid: selected.paidCents,
    due: selected.balanceDueCents,
  } : null, [selected])

  return <div className="tv-cash-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}`} backLabel="Cardápio" />
    <PageHeader className="tv-cash-page-header" eyebrow="Comandas e recebimentos" title="Caixa" description="Acompanhe contas por mesa, registre pagamentos recebidos e confira o demonstrativo antes de encerrar." actions={role === 'admin' ? <Button type="button" variant="outline" size="lg" className="tv-cash-settings-trigger" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><LuSettings2 aria-hidden="true" />Configurações do caixa</Button> : undefined} />
    <div className="tv-cash-toolbar">
      <span className={`tv-cash-live is-${realtimeStatus}`} role="status"><i aria-hidden="true" />{realtimeStatus === 'connected' ? 'Atualizado ao vivo' : realtimeStatus === 'connecting' ? 'Conectando ao tempo real' : 'Conexão interrompida · atualiza ao voltar à página'}</span>
    </div>

    {error ? <p className="tv-cash-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>Fechar</button></p> : null}
    <div className={`tv-cash-layout${mobile ? ' is-mobile' : ''}`}>
      {(!mobile || showMobileAccounts) ? <aside className="tv-cash-accounts" aria-label="Comandas por mesa">
        <div className="tv-cash-list-heading"><div><strong>Em aberto</strong><small>{active.length} {active.length === 1 ? 'comanda' : 'comandas'}</small></div>{refreshing ? <SpinnerRing decorative /> : null}</div>
        {active.length ? <ul>{active.map((account) => <li key={account.accountId}><button type="button" className={selectedId === account.accountId ? 'is-selected' : ''} onClick={() => selectAccount(account.accountId)}>
          <span className="tv-cash-table-number">{account.tableNumber}</span><span className="tv-cash-account-copy"><strong>Mesa {account.tableNumber}</strong><small>{account.status === 'settling' ? 'Fechamento iniciado' : 'Conta aberta'} · {formatCents(account.balanceDueCents)} pendente</small></span><span className="tv-cash-account-arrow"><LuArrowDownLeft aria-hidden="true" /></span>
        </button></li>)}</ul> : <p className="tv-cash-list-empty">Nenhuma comanda em aberto.</p>}
        <div className="tv-cash-list-heading is-recent"><div><strong>Fechadas recentemente</strong><small>Últimos registros</small></div></div>
        {recentClosed.length ? <ul>{recentClosed.map((account) => <li key={account.accountId}><button type="button" className={selectedId === account.accountId ? 'is-selected' : ''} onClick={() => selectAccount(account.accountId)}>
          <span className="tv-cash-table-number is-closed"><LuCheck aria-hidden="true" /></span><span className="tv-cash-account-copy"><strong>Mesa {account.tableNumber}</strong><small>{account.closedAt ? new Date(account.closedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Conta encerrada'} · {formatCents(account.totalCents)}</small></span>
        </button></li>)}</ul> : <p className="tv-cash-list-empty">As contas encerradas aparecerão aqui.</p>}
      </aside> : null}

      {(!mobile || !showMobileAccounts) ? <main className="tv-cash-detail">
        {mobile && selected ? <button type="button" className="tv-cash-mobile-back" onClick={() => setMobileAccountsOpen(true)}><LuArrowLeft aria-hidden="true" />Todas as comandas</button> : null}
        {selected && selectedSummary ? <>
          <div className="tv-cash-detail-heading"><div><span className={`tv-cash-status is-${selected.status}`}>{selected.status === 'open' ? 'Aberta' : selected.status === 'settling' ? 'Fechamento iniciado' : 'Fechada'}</span><h2>Mesa {selected.tableNumber}</h2><small>Aberta em {new Date(selected.openedAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
            <button type="button" className="tv-cash-print-button" onClick={() => window.print()}><LuPrinter aria-hidden="true" />Imprimir pré-conta</button>
          </div>

          <PreAccount restaurantName={restaurantName} account={selected} />

          {selected.status === 'open' ? <section className="tv-cash-settlement">
            {!showTipDecision ? <>
              <div><strong>Quando a mesa terminar o consumo</strong><p>Use “Registrar pagamento recebido” para pagamentos parciais. Iniciar o fechamento define a gorjeta e bloqueia novos pedidos para esta mesa.</p></div>
              <button type="button" className="tv-cash-start-close" onClick={() => setShowTipDecision(true)}>Encerrar consumo e fechar comanda</button>
            </> : <>
              <div><strong>Confirmar encerramento do consumo</strong><p>Depois desta decisão, novos pedidos ficam bloqueados. O caixa ainda pode registrar os pagamentos que faltarem. A gorjeta é única para a comanda e pode ser recusada.</p></div>
              {selected.tipMode === 'disabled' || selected.subtotalCents <= 0 ? <button type="button" disabled={busy} onClick={() => decideTip(false)}>{busy ? <SpinnerRing decorative /> : null}Fechar comanda sem gorjeta</button> : <div className="tv-cash-tip-options">
                <button type="button" disabled={busy} onClick={() => decideTip(false)}>Recusar gorjeta e fechar · {formatCents(0)}</button>
                <button type="button" disabled={busy} onClick={() => decideTip(true)}>Aceitar gorjeta e fechar · {formatCents(estimateTip(selected))}</button>
              </div>}
              <button type="button" className="tv-cash-secondary-button" disabled={busy} onClick={() => setShowTipDecision(false)}>Voltar</button>
            </>}
          </section> : null}

          {selected.status === 'settling' ? <div className="tv-cash-settling-note"><strong>Fechamento iniciado</strong><span>Novos pedidos estão bloqueados. Registre as formas de pagamento até o saldo chegar a zero.</span></div> : null}

          {selected.status !== 'closed' && selectedSummary.due > 0 ? <PaymentEntry key={`payment-entry:${selected.accountId}`} restaurantId={restaurantId} account={selected} methods={methods} onUpdated={applyAccount} /> : null}
          {selected.status === 'open' && selectedSummary.due === 0 ? <p className="tv-cash-paid-note">Saldo atual zerado. A comanda continua aberta para novos pedidos; inicie o fechamento somente quando a mesa terminar o consumo.</p> : null}
          {selected.status === 'closed' ? <p className="tv-cash-paid-note">Comanda encerrada. Os pagamentos e correções permanecem no histórico.</p> : null}

          {selected.payments.length || (role === 'admin' && selected.status === 'open') ? <AccountCorrections
            key={`account-corrections:${selected.accountId}`}
            restaurantId={restaurantId}
            account={selected}
            role={role}
            onUpdated={applyAccount}
          /> : null}

          {role === 'admin' && selected.status !== 'open' ? <section className="tv-cash-reopen">
            {!reopenOpen ? <button type="button" className="tv-cash-secondary-button" onClick={() => setReopenOpen(true)}>Reabrir comanda</button> : <div><label>Motivo da reabertura<input value={reopenReason} maxLength={500} onChange={(event) => setReopenReason(event.target.value)} placeholder="Ex.: fechamento iniciado por engano" /></label><div><button type="button" disabled={busy || reopenReason.trim().length < 3} onClick={reopen}>{busy ? <SpinnerRing decorative /> : null}Confirmar reabertura</button><button type="button" className="tv-cash-secondary-button" disabled={busy} onClick={() => setReopenOpen(false)}>Cancelar</button></div></div>}
          </section> : null}
        </> : <div className="tv-cash-empty"><span><LuPrinter aria-hidden="true" /></span><strong>Selecione uma comanda</strong><small>Os pedidos, pagamentos e saldo da mesa aparecerão aqui.</small></div>}
      </main> : null}
    </div>
    {role === 'admin' && settingsOpen ? <CashSettings
      restaurantId={restaurantId}
      settings={settings}
      mobile={mobile}
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      onSaved={setSettings}
    /> : null}
  </div>
}

function estimateTip(account: TableAccountDTO): number {
  if (account.subtotalCents <= 0) return 0
  if (account.tipMode === 'percentage') return Math.round(account.subtotalCents * (account.tipPercentBps ?? 0) / 10000)
  if (account.tipMode === 'fixed') return account.tipFixedCents ?? 0
  return 0
}
