'use client'

import { LuBanknote, LuCircleCheck, LuCircleDollarSign, LuLockKeyhole, LuRotateCcw, LuTrendingUp } from 'react-icons/lu'
import type { FinanceDashboardDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { formatRestaurantDateTime } from './finance-time'
import { FinanceDateRangeFilter } from './finance-date-range-filter'

export function CashDayStatus({ dashboard }: { dashboard: FinanceDashboardDTO }) {
  const activeDay = dashboard.activeDay
  return <section className={`tv-finance-active-day${activeDay ? ' is-open' : ' is-closed'}`} aria-label="Status do caixa">
    <div className="tv-finance-status-main">
      <span className={`tv-finance-status-icon${activeDay ? ' is-open' : ' is-closed'}`}>
        {activeDay ? <LuCircleCheck aria-hidden="true" /> : <LuLockKeyhole aria-hidden="true" />}
      </span>
      <div className="tv-finance-status-copy">
        <div className={`tv-finance-day-status${activeDay ? ' is-open' : ' is-closed'}`}>
          {activeDay ? 'Caixa aberto' : 'Nenhum caixa aberto'}
        </div>
        {activeDay ? <div className="tv-finance-day-meta">
          <span>Período iniciado {formatRestaurantDateTime(activeDay.openedAt, dashboard.timezone)}</span>
          <span>Fundo inicial <strong>{formatCents(activeDay.openingCashCents)}</strong></span>
        </div> : <p>O controle físico só existe durante períodos abertos. Os registros fora deles ficam no histórico.</p>}
      </div>
    </div>
    <span className={`tv-finance-status-pill${activeDay ? ' is-open' : ' is-closed'}`}>
      {activeDay ? 'Período em andamento' : 'Abertura pendente'}
    </span>
  </section>
}

export function CashDayOverview({ dashboard, onFilter, loading = false }: {
  dashboard: FinanceDashboardDTO
  onFilter: (from: string | null, to: string | null) => void
  loading?: boolean
}) {
  const { activeDay, totals } = dashboard
  if (!activeDay) return null

  return <>
    <FinanceDateRangeFilter
      initialFrom={dashboard.period.from}
      initialTo={dashboard.period.to}
      timezone={dashboard.timezone}
      loading={loading}
      heading="Período de análise"
      description="Os indicadores acompanham o intervalo; o dinheiro esperado mostra o caixa aberto completo."
      onApply={onFilter}
    />

    <section className="tv-finance-summary-hero" aria-label="Resumo do período">
      <div className="tv-finance-summary-primary">
        <span className="tv-finance-summary-label"><LuBanknote aria-hidden="true" /> Dinheiro esperado na gaveta</span>
        <strong>{formatCents(totals.expectedCashCents)}</strong>
        <small>Saldo do período aberto completo, independente do intervalo de análise.</small>
      </div>
      <div className="tv-finance-summary-support" aria-label="Indicadores do intervalo selecionado">
        <div><span><LuTrendingUp aria-hidden="true" /> Vendas de consumo</span><strong>{formatCents(totals.consumptionSalesCents)}</strong></div>
        <div><span><LuCircleDollarSign aria-hidden="true" /> Gorjetas brutas</span><strong>{formatCents(totals.grossTipsCents)}</strong></div>
        <div><span><LuBanknote aria-hidden="true" /> Recebido</span><strong>{formatCents(totals.receivedCents)}</strong></div>
        <div className="is-refund"><span><LuRotateCcw aria-hidden="true" /> Estornado</span><strong>{formatCents(totals.refundedCents)}</strong></div>
      </div>
    </section>

    <section className="tv-finance-card tv-finance-methods" aria-labelledby="tv-finance-methods-title">
      <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuBanknote aria-hidden="true" /></span><div><p>FORMAS DE PAGAMENTO</p><h2 id="tv-finance-methods-title">Recebimentos e devoluções</h2></div></div>
      {dashboard.methods.length ? <div className="tv-finance-method-list">
        {dashboard.methods.map((method) => <div key={method.methodId}>
          <strong>{method.methodName}</strong><span>Recebido <b>{formatCents(method.receivedCents)}</b></span><span>Estornado <b>{formatCents(method.refundedCents)}</b></span>
        </div>)}
      </div> : <p className="tv-finance-empty-inline">Ainda não há recebimentos neste período.</p>}
      <p className="tv-finance-footnote">Vendas e gorjetas são mostradas em valores brutos. Os estornos aparecem separados e não são distribuídos entre consumo e gorjeta.</p>
    </section>
  </>
}
