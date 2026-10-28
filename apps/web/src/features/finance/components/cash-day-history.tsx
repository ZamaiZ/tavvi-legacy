'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LuActivity, LuArrowDownLeft, LuArrowUpRight, LuBanknote, LuChevronDown, LuChevronRight, LuCircleCheck, LuClock3, LuHistory, LuReceiptText, LuRotateCcw, LuTriangleAlert, LuWallet } from 'react-icons/lu'
import type { CashDayDetailDTO, CashDayHistoryItemDTO } from '@/domain/finance'
import { formatTableAccountIdentity } from '@/domain/table-account'
import { getCashDayDetailsAction, getCashDayHistoryPageAction } from '@/server/actions/finance'
import { formatCents } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { PendingReceivables } from './pending-receivables'
import { formatRestaurantDateTime } from './finance-time'
import { FinanceMethodList } from './finance-method-list'

export function CashDayHistory({ restaurantId, history, historyHasMore, timezone, activeDayId, activeExpectedCashCents, refreshVersion }: {
  restaurantId: string
  history: CashDayHistoryItemDTO[]
  historyHasMore: boolean
  timezone: string
  activeDayId: string | null
  activeExpectedCashCents: number
  refreshVersion: number
}) {
  const [items, setItems] = useState(history)
  const [hasMore, setHasMore] = useState(historyHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [details, setDetails] = useState<CashDayDetailDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRevision = useRef(0)
  const nextOffset = useRef(history.length)

  useEffect(() => {
    setItems(history)
    setHasMore(historyHasMore)
    nextOffset.current = history.length
    setPageError(null)
  }, [history, historyHasMore])

  const loadDetails = useCallback(async (dayId: string) => {
    const revision = ++requestRevision.current
    setLoading(true)
    setError(null)
    try {
      const result = await getCashDayDetailsAction({ restaurantId, cashDayId: dayId })
      if (revision !== requestRevision.current) return
      if (!result.ok) { setError(result.error); return }
      if (!result.data) { setError('Este período não está mais disponível.'); return }
      setDetails(result.data)
    } catch {
      if (revision === requestRevision.current) setError('Não foi possível carregar os detalhes deste período.')
    } finally {
      if (revision === requestRevision.current) setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (selectedId) void loadDetails(selectedId)
  }, [selectedId, refreshVersion, loadDetails])

  function toggle(dayId: string) {
    if (selectedId === dayId) {
      requestRevision.current++
      setSelectedId(null)
      setDetails(null)
      setLoading(false)
      return
    }
    setSelectedId(dayId)
    setDetails(null)
    setError(null)
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setPageError(null)
    try {
      const result = await getCashDayHistoryPageAction({ restaurantId, offset: nextOffset.current })
      if (!result.ok) { setPageError(result.error); return }
      setItems((current) => {
        const known = new Set(current.map((day) => day.id))
        return [...current, ...result.data.history.filter((day) => !known.has(day.id))]
      })
      setHasMore(result.data.hasMore)
      nextOffset.current = result.data.nextOffset ?? nextOffset.current + result.data.history.length
    } catch {
      setPageError('Não foi possível carregar outros períodos.')
    } finally {
      setLoadingMore(false)
    }
  }

  return <section className="tv-finance-card tv-finance-history" aria-labelledby="tv-finance-history-title">
    <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuHistory aria-hidden="true" /></span><div><p>TRILHA DE CONFERÊNCIA</p><h2 id="tv-finance-history-title">Histórico de caixas</h2>
      <small>Cada abertura cria um período. Um restaurante pode ter mais de um período na mesma data.</small>
    </div></div>
    {items.length ? <div className="tv-finance-history-list">
      {items.map((day) => <article className={`tv-finance-history-item${selectedId === day.id ? ' is-selected' : ''}`} key={day.id}>
        <button type="button" onClick={() => void toggle(day.id)} aria-expanded={selectedId === day.id} aria-controls={selectedId === day.id ? `tv-finance-history-detail-${day.id}` : undefined}>
          <span className="tv-finance-history-chevron">{selectedId === day.id ? <LuChevronDown aria-hidden="true" /> : <LuChevronRight aria-hidden="true" />}</span>
          <span className="tv-finance-history-date"><strong>{formatRestaurantDateTime(day.openedAt, timezone, { dateStyle: 'full' })}</strong><small><LuClock3 aria-hidden="true" />{formatRestaurantDateTime(day.openedAt, timezone, { hour: '2-digit', minute: '2-digit' })} abertura{day.closedAt ? ` · ${formatRestaurantDateTime(day.closedAt, timezone, { hour: '2-digit', minute: '2-digit' })} fechamento` : ''}</small></span>
          <span className={`tv-finance-history-status is-${day.status}`}>{day.status === 'open' ? <LuClock3 aria-hidden="true" /> : <LuCircleCheck aria-hidden="true" />}{day.status === 'open' ? 'Em andamento' : 'Fechado'}</span>
          <span className="tv-finance-history-cash"><small>Fundo</small><strong>{formatCents(day.openingCashCents)}</strong></span>
          <span className="tv-finance-history-cash"><small>{day.status === 'open' ? 'Esperado agora' : 'Contado'}</small><strong>{formatCents(day.status === 'open' && day.id === activeDayId ? activeExpectedCashCents : day.status === 'open' ? day.expectedCashCents ?? 0 : day.countedCashCents ?? 0)}</strong></span>
        </button>
        {selectedId === day.id ? <div id={`tv-finance-history-detail-${day.id}`} className="tv-finance-history-detail">
          {loading ? <HistoryDetailSkeleton /> : error ? <div className="tv-finance-history-error">
            <p className="tv-finance-error" role="alert">{error}</p>
            <button type="button" className="tv-finance-history-retry" onClick={() => void loadDetails(day.id)}><LuRotateCcw aria-hidden="true" /> Tentar novamente</button>
          </div> : details ? <HistoryDetail restaurantId={restaurantId} details={details} timezone={timezone} /> : null}
        </div> : null}
      </article>)}
    </div> : <div className="tv-finance-empty-state"><span><LuHistory aria-hidden="true" /></span><strong>Nenhum período de caixa registrado</strong><p>Os períodos anteriores à implantação não têm fundo, contagem física ou fechamento reconstruídos.</p></div>}
    {pageError ? <p className="tv-finance-error" role="alert">{pageError}</p> : null}
    {hasMore ? <button type="button" className="tv-finance-history-more" aria-busy={loadingMore} disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <><SpinnerRing decorative /> Carregando períodos…</> : 'Carregar períodos anteriores'}</button> : null}
  </section>
}

function HistoryDetailSkeleton() {
  return <div className="tv-finance-history-skeleton" role="status" aria-label="Carregando detalhes do período">
    <div className="tv-finance-history-skeleton-group" aria-hidden="true">
      <span className="is-heading" /><span className="is-summary" /><span className="is-summary" /><span className="is-summary" />
    </div>
    <div className="tv-finance-history-skeleton-group" aria-hidden="true">
      <span className="is-heading" /><span className="is-summary" /><span className="is-summary" /><span className="is-summary" /><span className="is-summary" />
    </div>
    <div className="tv-finance-history-skeleton-group is-list" aria-hidden="true">
      <span className="is-heading" /><span className="is-row" /><span className="is-row" />
    </div>
    <div className="tv-finance-history-skeleton-group is-list" aria-hidden="true">
      <span className="is-heading" /><span className="is-row" /><span className="is-row" />
    </div>
    <div className="tv-finance-history-skeleton-group is-list" aria-hidden="true">
      <span className="is-heading" /><span className="is-row" /><span className="is-row" />
    </div>
    <div className="tv-finance-history-skeleton-group is-list" aria-hidden="true">
      <span className="is-heading" /><span className="is-row" /><span className="is-row" />
    </div>
    <span className="tv-finance-history-skeleton-sr">Carregando detalhes do período…</span>
  </div>
}

function HistoryDetail({ restaurantId, details, timezone }: { restaurantId: string; details: CashDayDetailDTO; timezone: string }) {
  const difference = details.cashDifferenceCents
  const hasDifference = difference !== null && difference !== 0
  return <>
    <section className="tv-finance-history-group is-reconciliation" aria-labelledby="tv-finance-history-reconciliation-title">
      <div className="tv-finance-history-group-heading"><span><LuBanknote aria-hidden="true" /></span><div><h3 id="tv-finance-history-reconciliation-title">Conferência do caixa</h3><small>Resumo do período e responsáveis pela operação</small></div></div>
      <div className="tv-finance-history-primary-values">
        <div><small>Dinheiro esperado</small><strong>{formatCents(details.expectedCashCents ?? details.totals.expectedCashCents)}</strong></div>
        <div><small>Dinheiro contado</small><strong>{formatCents(details.countedCashCents ?? 0)}</strong></div>
        <div className={hasDifference ? 'is-different' : difference === null ? 'is-unknown' : 'is-confirmed'}><small>Diferença</small><strong>{difference === null ? '—' : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatCents(Math.abs(difference))}`}</strong></div>
      </div>
      <dl className="tv-finance-history-operators">
        <div><dt>Aberto por</dt><dd>{`Operador ${details.openedBy.slice(0, 8)}`}</dd></div>
        <div><dt>Fechado por</dt><dd>{details.closedBy ? `Operador ${details.closedBy.slice(0, 8)}` : '—'}</dd></div>
      </dl>
    </section>

    <section className="tv-finance-history-group" aria-labelledby="tv-finance-history-activity-title">
      <div className="tv-finance-history-group-heading"><span><LuActivity aria-hidden="true" /></span><div><h3 id="tv-finance-history-activity-title">Atividade do período</h3><small>Totais consolidados de vendas e recebimentos</small></div></div>
      <dl className="tv-finance-history-activity">
        <div><dt>Vendas de consumo</dt><dd>{formatCents(details.totals.consumptionSalesCents)}</dd></div>
        <div><dt>Gorjetas brutas</dt><dd>{formatCents(details.totals.grossTipsCents)}</dd></div>
        <div><dt>Recebido</dt><dd>{formatCents(details.totals.receivedCents)}</dd></div>
        {details.totals.refundedCents > 0 ? <div><dt>Estornado</dt><dd>{formatCents(details.totals.refundedCents)}</dd></div> : null}
      </dl>
    </section>

    {details.methods.length ? <section className="tv-finance-history-group" aria-labelledby="tv-finance-history-methods-title">
      <div className="tv-finance-history-group-heading"><span><LuWallet aria-hidden="true" /></span><div><h3 id="tv-finance-history-methods-title">Formas de pagamento</h3><small>Recebimentos e estornos por método</small></div></div>
      <FinanceMethodList methods={details.methods} />
    </section> : null}

    {details.movements.length ? <section className="tv-finance-history-group" aria-labelledby="tv-finance-history-movements-title">
      <div className="tv-finance-history-group-heading"><span><LuArrowDownLeft aria-hidden="true" /></span><div><h3 id="tv-finance-history-movements-title">Movimentações de dinheiro</h3><small>Registros de entrada e retirada da gaveta</small></div></div>
      <div className="tv-finance-history-movement-list">{details.movements.map((movement) => {
        const replenishment = movement.type === 'replenishment'
        return <article className="tv-finance-history-movement" key={movement.id}>
          <span className={`tv-finance-movement-icon${replenishment ? ' is-in' : ' is-out'}`}>{replenishment ? <LuArrowDownLeft aria-hidden="true" /> : <LuArrowUpRight aria-hidden="true" />}</span>
          <div><strong>{replenishment ? 'Reforço' : 'Sangria'}</strong><p>{movement.reason}</p><small><LuClock3 aria-hidden="true" />{formatRestaurantDateTime(movement.createdAt, timezone, { dateStyle: 'short', timeStyle: 'short' })}<span aria-hidden="true">·</span>Operador {movement.createdBy.slice(0, 8)}</small></div>
          <b className={replenishment ? 'is-in' : 'is-out'}>{replenishment ? '+' : '−'}{formatCents(movement.amountCents)}</b>
        </article>
      })}</div>
    </section> : null}

    {details.carriedAccounts.length ? <section className="tv-finance-history-group" aria-labelledby="tv-finance-history-carried-title">
      <div className="tv-finance-history-group-heading"><span><LuReceiptText aria-hidden="true" /></span><div><h3 id="tv-finance-history-carried-title">Saldos transportados</h3><small>Comandas que permaneceram ligadas ao histórico após o fechamento</small></div></div>
      <div className="tv-finance-history-carried">{details.carriedAccounts.map((account) => <div key={account.accountId}>
        <span className="tv-finance-history-carried-icon"><LuReceiptText aria-hidden="true" /></span>
        <span className="tv-finance-history-carried-copy"><strong>{formatTableAccountIdentity(account)}</strong><small>{account.currentStatus === 'pending' ? 'Disponível para recebimento' : 'Conta quitada'}</small></span>
        <b>{formatCents(account.balanceAtCloseCents)}</b>
      </div>)}</div>
    </section> : null}

    {details.differenceReason || details.exceptionReason ? <section className="tv-finance-history-group is-audit" aria-labelledby="tv-finance-history-audit-title">
      <div className="tv-finance-history-group-heading"><span><LuTriangleAlert aria-hidden="true" /></span><div><h3 id="tv-finance-history-audit-title">Notas de auditoria</h3><small>Justificativas registradas no fechamento</small></div></div>
      {details.differenceReason ? <div className="tv-finance-audit-note is-difference"><strong>Motivo da diferença</strong><p>{details.differenceReason}</p></div> : null}
      {details.exceptionReason ? <div className="tv-finance-audit-note is-exception"><strong>Fechamento excepcional</strong><p>{details.exceptionReason}</p></div> : null}
    </section> : null}

    {details.pendingReceivables.length ? <PendingReceivables restaurantId={restaurantId} accounts={details.pendingReceivables} timezone={timezone} /> : null}
  </>
}
