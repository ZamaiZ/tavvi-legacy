'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LuCalendarClock, LuCircleDollarSign, LuRotateCcw, LuTrendingUp, LuWallet } from 'react-icons/lu'
import type { LegacyFinanceReportDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { getLegacyFinanceReportAction } from '@/server/actions/finance'
import { formatRestaurantDateTime } from './finance-time'
import { FinanceDateRangeFilter } from './finance-date-range-filter'
import { FinanceMethodList } from './finance-method-list'

export function LegacyFinanceReport({ restaurantId, initialReport, refreshVersion }: {
  restaurantId: string
  initialReport: LegacyFinanceReportDTO
  refreshVersion: number
}) {
  const [report, setReport] = useState(initialReport)
  const [period, setPeriod] = useState<{ from: string | null; to: string | null }>({ from: null, to: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRevision = useRef(0)
  const appliedRefreshVersion = useRef(refreshVersion)

  const refreshReport = useCallback(async (from: string | null, to: string | null) => {
    const revision = ++requestRevision.current
    setLoading(true)
    setError(null)
    try {
      const result = await getLegacyFinanceReportAction({ restaurantId, from, to })
      if (revision !== requestRevision.current) return
      if (!result.ok) { setError(result.error); return }
      setReport(result.data)
    } catch {
      if (revision === requestRevision.current) setError('Não foi possível carregar o histórico financeiro.')
    } finally {
      if (revision === requestRevision.current) setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (appliedRefreshVersion.current === refreshVersion) return
    appliedRefreshVersion.current = refreshVersion
    void refreshReport(period.from, period.to)
  }, [period.from, period.to, refreshReport, refreshVersion])

  function applyFilter(from: string | null, to: string | null) {
    setPeriod({ from, to })
    void refreshReport(from, to)
  }

  return <section className="tv-finance-legacy-report tv-finance-card" aria-labelledby="tv-finance-legacy-title">
    <div className="tv-finance-section-heading compact">
      <span className="tv-finance-icon"><LuCalendarClock aria-hidden="true" /></span>
      <div><p>REGISTROS SEM DIA DE CAIXA</p><h2 id="tv-finance-legacy-title">Receitas registradas fora de um período aberto</h2>
        <small>Pedidos e gorjetas são classificados pelo horário original, até {formatRestaurantDateTime(report.evaluatedAt, report.timezone)}.</small>
      </div>
    </div>
    <p className="tv-finance-footnote">Aqui entram pedidos e decisões de gorjeta feitos quando não havia caixa aberto, além de recebimentos legados sem vínculo. Não há contagem física, suprimentos ou sangrias reconstruídos para esses registros.</p>
    <FinanceDateRangeFilter
      key={`${period.from ?? 'all'}:${period.to ?? 'all'}`}
      initialFrom={period.from}
      initialTo={period.to}
      referenceDate={report.evaluatedAt}
      timezone={report.timezone}
      loading={loading}
      heading="Filtrar histórico"
      description="Deixe as datas vazias para consultar todo o período anterior."
      onApply={applyFilter}
    />
    {error ? <p className="tv-finance-error" role="alert">{error}</p> : null}
    <section className="tv-finance-metrics" aria-label="Receitas históricas sem fechamento físico">
      <article className="tv-finance-metric"><span><LuTrendingUp aria-hidden="true" /> Vendas de consumo</span><strong>{formatCents(report.totals.consumptionSalesCents)}</strong><small>Itens registrados no período</small></article>
      <article className="tv-finance-metric"><span><LuCircleDollarSign aria-hidden="true" /> Gorjetas brutas</span><strong>{formatCents(report.totals.grossTipsCents)}</strong><small>Gorjetas aceitas no período</small></article>
      <article className="tv-finance-metric"><span><LuTrendingUp aria-hidden="true" /> Recebido</span><strong>{formatCents(report.totals.receivedCents)}</strong><small>Todos os meios de pagamento</small></article>
      {report.totals.refundedCents > 0 ? <article className="tv-finance-metric is-refund"><span><LuRotateCcw aria-hidden="true" /> Estornado</span><strong>{formatCents(report.totals.refundedCents)}</strong><small>Devoluções registradas no período</small></article> : null}
    </section>
    {report.methods.length ? <section className="tv-finance-legacy-methods" aria-labelledby="tv-finance-legacy-methods-title">
      <div className="tv-finance-legacy-methods-heading"><span><LuWallet aria-hidden="true" /></span><div><small>FORMAS DE PAGAMENTO</small><h3 id="tv-finance-legacy-methods-title">Recebimentos por método</h3></div></div>
      <FinanceMethodList methods={report.methods} />
    </section> : <p className="tv-finance-empty-inline">{report.hasHistory ? 'Não há recebimentos no intervalo escolhido.' : 'Não há registros sem dia de caixa neste intervalo.'}</p>}
  </section>
}
