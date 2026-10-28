'use client'

import { LuBanknote, LuCircleDollarSign, LuRotateCcw, LuTrendingUp } from 'react-icons/lu'
import type { FinanceDashboardDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { formatRestaurantDateTime } from './finance-time'
import { FinanceDateRangeFilter } from './finance-date-range-filter'

export function CashDayOverview({ dashboard, onFilter, loading = false }: {
  dashboard: FinanceDashboardDTO
  onFilter: (from: string | null, to: string | null) => void
  loading?: boolean
}) {
  const { activeDay, totals } = dashboard

  return <>
    <section className="tv-finance-active-day" aria-label="Status do caixa">
      <div className={`tv-finance-day-status${activeDay ? ' is-open' : ' is-closed'}`}><i aria-hidden="true" />{activeDay ? 'Caixa aberto' : 'Nenhum caixa aberto'}</div>
      {activeDay ? <div className="tv-finance-day-meta">
        <span>Período iniciado {formatRestaurantDateTime(activeDay.openedAt, dashboard.timezone)}</span>
        <span>Fundo inicial <strong>{formatCents(activeDay.openingCashCents)}</strong></span>
      </div> : <p>O controle físico só existe durante períodos abertos. Registros fora desses períodos aparecem abaixo, sem reconstrução de valores em gaveta.</p>}
    </section>

    {activeDay ? <FinanceDateRangeFilter
      initialFrom={dashboard.period.from}
      initialTo={dashboard.period.to}
      timezone={dashboard.timezone}
      loading={loading}
      onApply={onFilter}
    /> : null}

    {activeDay ? <section className="tv-finance-metrics" aria-label="Resumo financeiro do dia">
      <article className="tv-finance-metric"><span><LuTrendingUp aria-hidden="true" /> Vendas de consumo</span><strong>{formatCents(totals.consumptionSalesCents)}</strong><small>Itens registrados no intervalo escolhido</small></article>
      <article className="tv-finance-metric"><span><LuCircleDollarSign aria-hidden="true" /> Gorjetas brutas</span><strong>{formatCents(totals.grossTipsCents)}</strong><small>Gorjetas aceitas no intervalo</small></article>
      <article className="tv-finance-metric"><span><LuBanknote aria-hidden="true" /> Recebido</span><strong>{formatCents(totals.receivedCents)}</strong><small>Todos os meios, incluindo gorjetas cobradas</small></article>
      <article className="tv-finance-metric is-refund"><span><LuRotateCcw aria-hidden="true" /> Estornado</span><strong>{formatCents(totals.refundedCents)}</strong><small>Devoluções registradas no intervalo</small></article>
      <article className="tv-finance-metric is-cash"><span><LuBanknote aria-hidden="true" /> Dinheiro esperado</span><strong>{formatCents(totals.expectedCashCents)}</strong><small>Fundo inicial + entradas − troco, estornos em espécie e sangrias</small></article>
    </section> : null}

    {activeDay ? <section className="tv-finance-card tv-finance-methods" aria-labelledby="tv-finance-methods-title">
      <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuBanknote aria-hidden="true" /></span><div><p>FORMAS DE PAGAMENTO</p><h2 id="tv-finance-methods-title">Recebimentos e devoluções</h2></div></div>
      {dashboard.methods.length ? <div className="tv-finance-method-list">
        {dashboard.methods.map((method) => <div key={method.methodId}>
          <strong>{method.methodName}</strong><span>Recebido <b>{formatCents(method.receivedCents)}</b></span><span>Estornado <b>{formatCents(method.refundedCents)}</b></span>
        </div>)}
      </div> : <p className="tv-finance-empty-inline">Ainda não há recebimentos neste período.</p>}
      <p className="tv-finance-footnote">Vendas e gorjetas são mostradas em valores brutos. Os estornos aparecem separados e não são distribuídos entre consumo e gorjeta.</p>
    </section> : null}
  </>
}
