'use client'

import { useCallback, useState, useTransition } from 'react'
import { LuRefreshCw } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import type { FinanceDashboardDTO, LegacyFinanceReportDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { getFinanceDashboardAction } from '@/server/actions/finance'
import { CashDayClosing } from './cash-day-closing'
import { CashDayHistory } from './cash-day-history'
import { CashDayMovements } from './cash-day-movements'
import { CashDayOpening } from './cash-day-opening'
import { CashDayOverview } from './cash-day-overview'
import { PendingReceivables } from './pending-receivables'
import { LegacyFinanceReport } from './legacy-finance-report'
import { useFinanceRealtime } from '../use-finance-realtime'

export function FinanceScreen({ restaurantId, restaurantName, role, initialDashboard, initialLegacyReport }: {
  restaurantId: string
  restaurantName: string
  role: MemberRole
  initialDashboard: FinanceDashboardDTO
  initialLegacyReport: LegacyFinanceReportDTO
}) {
  const [dashboard, setDashboard] = useState(initialDashboard)
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
  const realtimeStatus = useFinanceRealtime(restaurantId, refreshLive)

  return <div className="tv-finance-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}`} backLabel="Restaurante" title="Financeiro" />
    <PageHeader
      className="tv-finance-page-header"
      eyebrow={restaurantName}
      title="Financeiro"
      description="Acompanhe receitas, formas de recebimento e o dinheiro físico do restaurante por período de caixa."
      actions={<Button type="button" variant="outline" size="lg" disabled={refreshing} onClick={() => reload()}>
        {refreshing ? <SpinnerRing decorative /> : <LuRefreshCw aria-hidden="true" />} Atualizar
      </Button>}
    />
    <p className={`tv-finance-live-status is-${realtimeStatus}`} role="status"><i aria-hidden="true" />
      {realtimeStatus === 'connected' ? 'Atualizado ao vivo' : realtimeStatus === 'connecting' ? 'Conectando ao tempo real…' : 'Conexão interrompida · use Atualizar para conferir os dados.'}
    </p>
    <div className="tv-finance-note"><strong>Escopo atual</strong><span>Esta etapa cobre receitas, abertura, movimentações e fechamento do caixa. Despesas, taxas, impostos, estoque e consumo interno serão adicionados em etapas próprias.</span></div>
    {filterError ? <p className="tv-finance-error" role="alert">{filterError}</p> : null}
    {refreshing ? <p className="tv-finance-refresh-status" role="status">Atualizando os valores…</p> : null}

    <CashDayOverview key={`${dashboard.activeDay?.id ?? 'no-active-day'}:${dashboard.period.from}:${dashboard.period.to}`} dashboard={dashboard} loading={refreshing} onFilter={(from, to) => reload(from, to)} />
    <LegacyFinanceReport restaurantId={restaurantId} initialReport={initialLegacyReport} refreshVersion={legacyRefreshVersion} />
    {!dashboard.activeDay && dashboard.accountsBlockingClose.length ? <section className="tv-finance-existing-accounts" aria-label="Comandas abertas antes da abertura do caixa">
      <strong>{dashboard.accountsBlockingClose.length} {dashboard.accountsBlockingClose.length === 1 ? 'comanda está' : 'comandas estão'} em andamento</strong>
      <span>As comandas podem continuar operando sem caixa aberto, mas precisam ser finalizadas antes de um fechamento normal.</span>
      <ul>{dashboard.accountsBlockingClose.map((account) => <li key={account.accountId}>Mesa {account.tableNumber}<b>{formatCents(account.balanceDueCents)} pendente</b></li>)}</ul>
    </section> : null}
    {!dashboard.activeDay ? <CashDayOpening key="cash-day-opening" restaurantId={restaurantId} onUpdated={updateDashboard} /> : <>
      <PendingReceivables restaurantId={restaurantId} accounts={dashboard.pendingReceivables} timezone={dashboard.timezone} />
      <div className="tv-finance-two-column">
        <CashDayMovements restaurantId={restaurantId} cashDayId={dashboard.activeDay.id} movements={dashboard.movements} timezone={dashboard.timezone} onUpdated={updateDashboard} />
        <CashDayClosing restaurantId={restaurantId} dashboard={dashboard} role={role} onUpdated={updateDashboard} />
      </div>
    </>}
    <CashDayHistory restaurantId={restaurantId} history={dashboard.history} timezone={dashboard.timezone} refreshVersion={legacyRefreshVersion}
      historyHasMore={dashboard.historyHasMore}
      activeDayId={dashboard.activeDay?.id ?? null} activeExpectedCashCents={dashboard.totals.expectedCashCents} />
  </div>
}
