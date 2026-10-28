'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { LuArrowLeft, LuPrinter, LuSettings2 } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import type { CheckoutSettingsDTO, TableAccountDTO, TableAccountSummaryDTO } from '@/domain/table-account'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  decideTipAndCloseAction,
  getTableAccountDetailsAction,
  getCheckoutSettingsAction,
  listCashAccountsAction,
  reopenTableAccountAction,
} from '@/server/actions/table-accounts'
import { useTableAccountsRealtime } from '../use-table-accounts-realtime'
import { CashSettings } from './cash-settings'
import { CashAccountList } from './cash-account-list'
import { CashAccountTabs, type CashOperationState, type CashTab } from './cash-account-tabs'

export function CashScreen({
  restaurantId,
  restaurantName,
  role,
  initialActive,
  initialRecentClosed,
  initialSelectedAccount,
  initialSettings,
}: {
  restaurantId: string
  restaurantName: string
  role: MemberRole
  initialActive: TableAccountSummaryDTO[]
  initialRecentClosed: TableAccountSummaryDTO[]
  initialSelectedAccount: TableAccountDTO | null
  initialSettings: CheckoutSettingsDTO
}) {
  const mobile = useIsMobile()
  const [active, setActive] = useState<TableAccountSummaryDTO[]>(initialActive)
  const [recentClosed, setRecentClosed] = useState(initialRecentClosed)
  const [settings, setSettings] = useState(initialSettings)
  const [selectedId, setSelectedId] = useState(initialSelectedAccount?.accountId ?? initialActive[0]?.accountId ?? initialRecentClosed[0]?.accountId ?? null)
  const [selectedAccount, setSelectedAccount] = useState<TableAccountDTO | null>(initialSelectedAccount)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileAccountsOpen, setMobileAccountsOpen] = useState(true)
  const [selectedTab, setSelectedTab] = useState<CashTab>('conta')
  const [operationState, setOperationState] = useState<CashOperationState>('idle')
  const [listFilter, setListFilter] = useState<'active' | 'closed'>(initialActive.length ? 'active' : initialRecentClosed.length ? 'closed' : 'active')
  const [detailLoading, setDetailLoading] = useState(false)
  const [showTipDecision, setShowTipDecision] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenOpen, setReopenOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, startTransition] = useTransition()
  const operationStateRef = useRef<CashOperationState>('idle')
  const parentMutationRef = useRef(false)
  const operationLockedRef = useRef(false)
  const settlementRequestIds = useRef(new Map<string, string>())
  const refreshRevision = useRef(0)
  const detailRevision = useRef(0)
  const selectedIdRef = useRef(selectedId)
  const selectedStatusRef = useRef(initialSelectedAccount?.status ?? null)

  const selected = selectedAccount?.accountId === selectedId ? selectedAccount : null
  const showMobileAccounts = mobile && (mobileAccountsOpen || !selectedId)
  const methods = settings.paymentMethods.filter((method) => method.isActive)

  const loadSelectedAccount = useCallback(async (accountId: string) => {
    const revision = ++detailRevision.current
    setDetailLoading(true)
    try {
      const result = await getTableAccountDetailsAction({ restaurantId, accountId })
      if (revision !== detailRevision.current || selectedIdRef.current !== accountId) return
      if (!result.ok) { setError(result.error); setSelectedAccount(null); return }
      if (!result.data) { setError('Esta comanda não está mais disponível. Atualize a lista de mesas.'); setSelectedAccount(null); return }
      setSelectedAccount(result.data)
      selectedStatusRef.current = result.data.status
      setError(null)
    } catch {
      if (revision === detailRevision.current && selectedIdRef.current === accountId) {
        setSelectedAccount(null)
        setError('Não foi possível carregar os detalhes desta comanda.')
      }
    } finally {
      if (revision === detailRevision.current && selectedIdRef.current === accountId) setDetailLoading(false)
    }
  }, [restaurantId])

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
      let accountId = selectedIdRef.current
      const previousStatus = selectedStatusRef.current
      const stillAvailable = accountId && (result.data.active.some((account) => account.accountId === accountId)
        || result.data.recentClosed.some((account) => account.accountId === accountId))
      if (!stillAvailable && !operationLockedRef.current) {
        accountId = result.data.active[0]?.accountId ?? result.data.recentClosed[0]?.accountId ?? null
        selectedIdRef.current = accountId
        setSelectedId(accountId)
        setError('A comanda selecionada não está mais na lista. A seleção foi atualizada.')
      }
      if (accountId) {
        const detailRequest = ++detailRevision.current
        setDetailLoading(true)
        try {
          const detailResult = await getTableAccountDetailsAction({ restaurantId, accountId })
          if (revision !== refreshRevision.current || detailRequest !== detailRevision.current || selectedIdRef.current !== accountId) return
          if (!detailResult.ok) { setError(detailResult.error); return }
          if (detailResult.data) {
            setSelectedAccount(detailResult.data)
            selectedStatusRef.current = detailResult.data.status
            if (previousStatus && previousStatus !== detailResult.data.status) {
              setListFilter(detailResult.data.status === 'closed' ? 'closed' : 'active')
            }
          } else {
            setSelectedAccount(null)
            selectedStatusRef.current = null
            setError('Esta comanda não está mais disponível. Atualize a lista de mesas.')
          }
        } finally {
          if (detailRequest === detailRevision.current && selectedIdRef.current === accountId) setDetailLoading(false)
        }
      } else {
        detailRevision.current++
        selectedIdRef.current = null
        setSelectedId(null)
        setSelectedAccount(null)
        selectedStatusRef.current = null
        setDetailLoading(false)
      }
    } catch {
      if (revision === refreshRevision.current) setError('Não foi possível atualizar as comandas agora.')
    } finally {
      if (revision === refreshRevision.current) setRefreshing(false)
    }
  }, [restaurantId])
  const realtimeStatus = useTableAccountsRealtime(restaurantId, refresh)

  function updateOperationState(state: CashOperationState) {
    operationStateRef.current = state
    operationLockedRef.current = parentMutationRef.current || state !== 'idle'
    setOperationState(state)
  }

  function beginParentMutation() {
    parentMutationRef.current = true
    operationLockedRef.current = true
  }

  function endParentMutation() {
    parentMutationRef.current = false
    operationLockedRef.current = operationStateRef.current !== 'idle'
  }

  function applyAccount(account: TableAccountDTO) {
    refreshRevision.current++
    setRefreshing(false)
    const summary = toSummary(account)
    detailRevision.current++
    setDetailLoading(false)
    setSelectedAccount(account)
    selectedStatusRef.current = account.status
    selectedIdRef.current = account.accountId
    setActive((current) => account.status === 'closed'
      ? current.filter((item) => item.accountId !== account.accountId)
      : [summary, ...current.filter((item) => item.accountId !== account.accountId)].sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.accountId.localeCompare(b.accountId)))
    setRecentClosed((current) => account.status === 'closed'
      ? [summary, ...current.filter((item) => item.accountId !== account.accountId)].slice(0, 25)
      : current.filter((item) => item.accountId !== account.accountId))
    setSelectedId(account.accountId)
    setListFilter(account.status === 'closed' ? 'closed' : 'active')
    setShowTipDecision(false)
    setReopenOpen(false)
    setReopenReason('')
    setError(null)
  }

  function selectAccount(accountId: string) {
    if (operationState !== 'idle' || busy) {
      setError('Conclua ou repita a operação pendente antes de trocar de mesa.')
      return
    }
    if (accountId === selectedIdRef.current) {
      setMobileAccountsOpen(false)
      return
    }
    selectedIdRef.current = accountId
    setSelectedId(accountId)
    setSelectedAccount(null)
    selectedStatusRef.current = null
    setError(null)
    setMobileAccountsOpen(false)
    setShowTipDecision(false)
    setReopenOpen(false)
    setReopenReason('')
    setSelectedTab('conta')
    void loadSelectedAccount(accountId)
  }

  function changeTab(tab: CashTab) {
    if (operationState !== 'idle' || busy) {
      setError('Conclua ou repita a operação pendente antes de trocar de área.')
      return
    }
    setSelectedTab(tab)
  }

  function decideTip(accepted: boolean) {
    if (!selected || busy) return
    setError(null)
    const key = `${selected.accountId}:${accepted}`
    const requestId = settlementRequestIds.current.get(key) ?? crypto.randomUUID()
    settlementRequestIds.current.set(key, requestId)
    beginParentMutation()
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
      } finally {
        endParentMutation()
      }
    })
  }

  function reopen() {
    if (!selected || busy || !reopenReason.trim()) return
    const key = `${selected.accountId}:reopen:${reopenReason.trim()}`
    const requestId = settlementRequestIds.current.get(key) ?? crypto.randomUUID()
    settlementRequestIds.current.set(key, requestId)
    beginParentMutation()
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
      } finally {
        endParentMutation()
      }
    })
  }

  return <div className={`tv-cash-page${mobile && !showMobileAccounts ? ' is-detail-open' : ''}`}>
    <MobileNavBar backHref={`/restaurantes/${restaurantId}`} backLabel="Cardápio" />
    <PageHeader className="tv-cash-page-header" eyebrow="Comandas e recebimentos" title="Caixa" description="Acompanhe contas por mesa, registre pagamentos recebidos e confira o demonstrativo antes de encerrar." actions={role === 'admin' ? <Button type="button" variant="outline" size="lg" className="tv-cash-settings-trigger" disabled={operationState !== 'idle' || busy} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><LuSettings2 aria-hidden="true" />Configurações do caixa</Button> : undefined} />
    <div className="tv-cash-toolbar">
      <span className={`tv-cash-live is-${realtimeStatus}`} role="status"><i aria-hidden="true" />{realtimeStatus === 'connected' ? 'Atualizado ao vivo' : realtimeStatus === 'connecting' ? 'Conectando ao tempo real' : 'Conexão interrompida · atualiza ao voltar à página'}</span>
    </div>

    {error ? <p className="tv-cash-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>Fechar</button></p> : null}
    <div className={`tv-cash-layout${mobile ? ' is-mobile' : ''}`}>
      {(!mobile || showMobileAccounts) ? <CashAccountList
        active={active}
        recentClosed={recentClosed}
        selectedId={selectedId}
        filter={listFilter}
        refreshing={refreshing}
        navigationLocked={operationState !== 'idle' || busy}
        onFilterChange={setListFilter}
        onSelect={selectAccount}
      /> : null}

      {(!mobile || !showMobileAccounts) ? <main className="tv-cash-detail">
        {mobile ? <button type="button" className="tv-cash-mobile-back" disabled={operationState !== 'idle' || busy} onClick={() => setMobileAccountsOpen(true)}><LuArrowLeft aria-hidden="true" />Todas as comandas</button> : null}
        {detailLoading && selectedId ? <div className="tv-cash-detail-loading" role="status" aria-busy="true"><SpinnerRing decorative /><span>Carregando a comanda…</span></div> : null}
        {selected ? <CashAccountTabs
          account={selected}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          role={role}
          methods={methods}
          selectedTab={selectedTab}
          onTabChange={changeTab}
          onUpdated={applyAccount}
          onOperationStateChange={updateOperationState}
          operationState={operationState}
          navigationLocked={operationState !== 'idle' || busy}
          busy={busy}
          showTipDecision={showTipDecision}
          onShowTipDecisionChange={setShowTipDecision}
          onDecideTip={decideTip}
          reopenOpen={reopenOpen}
          onReopenOpenChange={setReopenOpen}
          reopenReason={reopenReason}
          onReopenReasonChange={setReopenReason}
          onReopen={reopen}
        /> : !detailLoading ? <div className="tv-cash-empty"><span><LuPrinter aria-hidden="true" /></span><strong>{selectedId ? 'Comanda indisponível' : 'Selecione uma comanda'}</strong><small>{selectedId ? 'Não foi possível carregar os detalhes desta mesa.' : 'Os pedidos, pagamentos e saldo da mesa aparecerão aqui.'}</small></div> : null}
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

function toSummary(account: TableAccountDTO): TableAccountSummaryDTO {
  return {
    accountId: account.accountId,
    restaurantId: account.restaurantId,
    tableNumber: account.tableNumber,
    status: account.status,
    tipMode: account.tipMode,
    tipPercentBps: account.tipPercentBps,
    tipFixedCents: account.tipFixedCents,
    tipAccepted: account.tipAccepted,
    tipAmountCents: account.tipAmountCents,
    openedAt: account.openedAt,
    closedAt: account.closedAt,
    subtotalCents: account.subtotalCents,
    tipCents: account.tipCents,
    totalCents: account.totalCents,
    paidCents: account.paidCents,
    balanceDueCents: account.balanceDueCents,
  }
}
