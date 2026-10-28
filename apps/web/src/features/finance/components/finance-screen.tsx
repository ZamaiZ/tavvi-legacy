'use client'

import { useCallback, useState, useTransition } from 'react'
import { LuArrowDownLeft, LuArrowRight, LuBriefcaseBusiness, LuCircleCheck, LuCircleDollarSign, LuHistory, LuReceiptText, LuTrendingUp } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import type { FinanceDashboardDTO, LegacyFinanceReportDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getFinanceDashboardAction } from '@/server/actions/finance'
import { CashDayClosing } from './cash-day-closing'
import { CashDayHistory } from './cash-day-history'
import { CashDayMovements } from './cash-day-movements'
import { CashDayOpening } from './cash-day-opening'
import { CashDayOverview, CashDayStatus } from './cash-day-overview'
import { PendingReceivables } from './pending-receivables'
import { LegacyFinanceReport } from './legacy-finance-report'
import { formatRestaurantDateTime } from './finance-time'
import { useFinanceRealtime } from '../use-finance-realtime'

type FinanceArea = 'overview' | 'operation' | 'history'
type OperationArea = 'movements' | 'receivables' | 'closing'
type HistoryArea = 'periods' | 'legacy'

export function FinanceScreen({ restaurantId, restaurantName, role, initialDashboard, initialLegacyReport }: {
  restaurantId: string
  restaurantName: string
  role: MemberRole
  initialDashboard: FinanceDashboardDTO
  initialLegacyReport: LegacyFinanceReportDTO
}) {
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [activeArea, setActiveArea] = useState<FinanceArea>(initialDashboard.activeDay ? 'overview' : 'operation')
  const [operationSelection, setOperationSelection] = useState<{ cashDayId: string | null; area: OperationArea }>({
    cashDayId: initialDashboard.activeDay?.id ?? null,
    area: 'movements',
  })
  const operationArea = operationSelection.cashDayId === (dashboard.activeDay?.id ?? null) ? operationSelection.area : 'movements'
  const [historyArea, setHistoryArea] = useState<HistoryArea>('periods')
  const [legacyRefreshVersion, setLegacyRefreshVersion] = useState(0)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [refreshing, startTransition] = useTransition()

  const updateDashboard = useCallback((next: FinanceDashboardDTO) => {
    setDashboard(next)
    setLegacyRefreshVersion((version) => version + 1)
    setFilterError(null)
  }, [])

  const reload = useCallback((from?: string | null, to?: string | null) => {
    setFilterError(null)
    startTransition(async () => {
      try {
        const result = await getFinanceDashboardAction({ restaurantId, from: from ?? null, to: to ?? null })
        if (!result.ok) { setFilterError(result.error); return }
        updateDashboard(result.data)
      } catch {
        setFilterError('Não foi possível atualizar o panorama financeiro.')
      }
    })
  }, [restaurantId, updateDashboard])

  const refreshLive = useCallback(() => reload(dashboard.period.from, dashboard.period.to), [dashboard.period.from, dashboard.period.to, reload])
  useFinanceRealtime(restaurantId, refreshLive)
  const lastClosedPeriod = dashboard.history.find((day) => day.status === 'closed' && day.countedCashCents !== null)

  return <div className="tv-finance-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}`} backLabel="Restaurante" title="Financeiro" />
    <PageHeader
      className="tv-finance-page-header"
      eyebrow={restaurantName}
      title="Financeiro"
      description="Acompanhe receitas, formas de recebimento e o dinheiro físico do restaurante por período de caixa."
    />
    <CashDayStatus dashboard={dashboard} />
    {filterError ? <p className="tv-finance-error" role="alert">{filterError}</p> : null}
    {refreshing ? <p className="tv-finance-refresh-status" role="status">Atualizando os valores…</p> : null}

    <Tabs value={activeArea} onValueChange={(value) => setActiveArea(value as FinanceArea)} className="tv-finance-main-tabs">
      <TabsList aria-label="Áreas do Financeiro">
        <TabsTrigger value="overview"><LuTrendingUp aria-hidden="true" /><span>Visão geral</span></TabsTrigger>
        <TabsTrigger value="operation"><LuBriefcaseBusiness aria-hidden="true" /><span>Operação</span></TabsTrigger>
        <TabsTrigger value="history"><LuHistory aria-hidden="true" /><span>Histórico</span></TabsTrigger>
      </TabsList>

      <TabsContent value="overview" keepMounted className="tv-finance-tab-panel">
        {dashboard.activeDay ? <CashDayOverview key={`${dashboard.activeDay.id}:${dashboard.period.from}:${dashboard.period.to}`} dashboard={dashboard} loading={refreshing} onFilter={(from, to) => reload(from, to)} /> : <section className="tv-finance-closed-summary" aria-labelledby="tv-finance-closed-summary-title">
          <span className="tv-finance-closed-icon"><LuCircleDollarSign aria-hidden="true" /></span>
          <div className="tv-finance-closed-copy">
            <p className="tv-finance-section-kicker">PANORAMA DO RESTAURANTE</p>
            <h2 id="tv-finance-closed-summary-title">Seu resumo começa com a abertura do caixa</h2>
            <p>Quando um período estiver aberto, os valores do dia e as formas de recebimento aparecem aqui, separados do histórico.</p>
            <Button type="button" size="lg" onClick={() => setActiveArea('operation')}>
              Ir para abertura do caixa <LuArrowRight aria-hidden="true" />
            </Button>
          </div>
          {lastClosedPeriod ? <div className="tv-finance-last-period">
            <span>Último período encerrado</span>
            <strong>{formatCents(lastClosedPeriod.countedCashCents ?? 0)} <small>contados</small></strong>
            <small>{formatRestaurantDateTime(lastClosedPeriod.openedAt, dashboard.timezone, { dateStyle: 'medium' })}</small>
          </div> : null}
        </section>}
      </TabsContent>

      <TabsContent value="operation" keepMounted className="tv-finance-tab-panel">
        {!dashboard.activeDay && dashboard.accountsBlockingClose.length ? <section className="tv-finance-existing-accounts" aria-label="Comandas abertas antes da abertura do caixa">
          <strong>{dashboard.accountsBlockingClose.length} {dashboard.accountsBlockingClose.length === 1 ? 'comanda está' : 'comandas estão'} em andamento</strong>
          <span>As comandas podem continuar operando sem caixa aberto, mas precisam ser finalizadas antes de um fechamento normal.</span>
          <ul>{dashboard.accountsBlockingClose.map((account) => <li key={account.accountId}>Mesa {account.tableNumber}<b>{formatCents(account.balanceDueCents)} pendente</b></li>)}</ul>
        </section> : null}
        {!dashboard.activeDay ? <CashDayOpening key="cash-day-opening" restaurantId={restaurantId} onUpdated={updateDashboard} /> : <Tabs value={operationArea} onValueChange={(value) => setOperationSelection({ cashDayId: dashboard.activeDay?.id ?? null, area: value as OperationArea })} className="tv-finance-operation-tabs">
          <TabsList aria-label="Responsabilidades do caixa">
            <TabsTrigger value="movements" aria-label="Movimentações"><LuArrowDownLeft aria-hidden="true" /><span>Movimentações</span></TabsTrigger>
            <TabsTrigger value="receivables" aria-label={`Recebimentos pendentes, ${dashboard.pendingReceivables.length} ${dashboard.pendingReceivables.length === 1 ? 'comanda' : 'comandas'}`}>
              <LuCircleDollarSign aria-hidden="true" /><span className="tv-finance-operation-tab-wide">Recebimentos pendentes</span><span className="tv-finance-operation-tab-short">Pendentes</span>
              {dashboard.pendingReceivables.length ? <span className="tv-finance-tab-count" aria-hidden="true">{dashboard.pendingReceivables.length}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="closing" aria-label="Fechamento"><LuCircleCheck aria-hidden="true" /><span>Fechamento</span></TabsTrigger>
          </TabsList>

          <TabsContent value="movements" keepMounted className="tv-finance-subtab-panel">
            <CashDayMovements restaurantId={restaurantId} cashDayId={dashboard.activeDay.id} movements={dashboard.movements}
              expectedCashCents={dashboard.totals.expectedCashCents} timezone={dashboard.timezone} onUpdated={updateDashboard} />
          </TabsContent>
          <TabsContent value="receivables" keepMounted className="tv-finance-subtab-panel">
            <PendingReceivables restaurantId={restaurantId} accounts={dashboard.pendingReceivables} timezone={dashboard.timezone} />
          </TabsContent>
          <TabsContent value="closing" keepMounted className="tv-finance-subtab-panel">
            <CashDayClosing restaurantId={restaurantId} dashboard={dashboard} role={role} onUpdated={updateDashboard} />
          </TabsContent>
        </Tabs>}
      </TabsContent>

      <TabsContent value="history" keepMounted className="tv-finance-tab-panel">
        <Tabs value={historyArea} onValueChange={(value) => setHistoryArea(value as HistoryArea)} className="tv-finance-history-tabs">
          <TabsList aria-label="Tipos de histórico financeiro">
            <TabsTrigger value="periods" aria-label="Períodos de caixa"><LuHistory aria-hidden="true" /><span>Períodos de caixa</span></TabsTrigger>
            <TabsTrigger value="legacy" aria-label="Receitas sem caixa"><LuReceiptText aria-hidden="true" /><span>Receitas sem caixa</span></TabsTrigger>
          </TabsList>
          <TabsContent value="periods" keepMounted className="tv-finance-subtab-panel">
            <CashDayHistory restaurantId={restaurantId} history={dashboard.history} timezone={dashboard.timezone} refreshVersion={legacyRefreshVersion}
              historyHasMore={dashboard.historyHasMore}
              activeDayId={dashboard.activeDay?.id ?? null} activeExpectedCashCents={dashboard.totals.expectedCashCents} />
          </TabsContent>
          <TabsContent value="legacy" keepMounted className="tv-finance-subtab-panel">
            <LegacyFinanceReport restaurantId={restaurantId} initialReport={initialLegacyReport} refreshVersion={legacyRefreshVersion} />
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  </div>
}
