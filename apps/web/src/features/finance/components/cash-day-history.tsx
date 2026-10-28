'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuClock3, LuHistory } from 'react-icons/lu'
import type { CashDayDetailDTO, CashDayHistoryItemDTO } from '@/domain/finance'
import { getCashDayDetailsAction, getCashDayHistoryPageAction } from '@/server/actions/finance'
import { formatCents } from '@/lib/money'
import { PendingReceivables } from './pending-receivables'
import { formatRestaurantDateTime } from './finance-time'

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
        <button type="button" onClick={() => void toggle(day.id)} aria-expanded={selectedId === day.id}>
          <span className="tv-finance-history-chevron">{selectedId === day.id ? <LuChevronDown aria-hidden="true" /> : <LuChevronRight aria-hidden="true" />}</span>
          <span className="tv-finance-history-date"><strong>{formatRestaurantDateTime(day.openedAt, timezone, { dateStyle: 'full' })}</strong><small><LuClock3 aria-hidden="true" />{formatRestaurantDateTime(day.openedAt, timezone, { hour: '2-digit', minute: '2-digit' })} abertura{day.closedAt ? ` · ${formatRestaurantDateTime(day.closedAt, timezone, { hour: '2-digit', minute: '2-digit' })} fechamento` : ''}</small></span>
          <span className={`tv-finance-history-status is-${day.status}`}>{day.status === 'open' ? 'Em andamento' : 'Fechado'}</span>
          <span className="tv-finance-history-cash"><small>Fundo</small><strong>{formatCents(day.openingCashCents)}</strong></span>
          <span className="tv-finance-history-cash"><small>{day.status === 'open' ? 'Esperado agora' : 'Contado'}</small><strong>{formatCents(day.status === 'open' && day.id === activeDayId ? activeExpectedCashCents : day.status === 'open' ? day.expectedCashCents ?? 0 : day.countedCashCents ?? 0)}</strong></span>
        </button>
        {selectedId === day.id ? <div className="tv-finance-history-detail">
          {loading ? <p role="status">Carregando detalhes…</p> : error ? <p className="tv-finance-error" role="alert">{error}</p> : details ? <HistoryDetail restaurantId={restaurantId} details={details} timezone={timezone} /> : null}
        </div> : null}
      </article>)}
    </div> : <div className="tv-finance-empty-state"><span><LuHistory aria-hidden="true" /></span><strong>Nenhum período de caixa registrado</strong><p>Os períodos anteriores à implantação não têm fundo, contagem física ou fechamento reconstruídos.</p></div>}
    {pageError ? <p className="tv-finance-error" role="alert">{pageError}</p> : null}
    {hasMore ? <button type="button" className="tv-finance-history-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Carregando…' : 'Carregar períodos anteriores'}</button> : null}
  </section>
}

function HistoryDetail({ restaurantId, details, timezone }: { restaurantId: string; details: CashDayDetailDTO; timezone: string }) {
  const difference = details.cashDifferenceCents
  return <>
    <dl className="tv-finance-history-summary">
      <div><dt>Aberto por</dt><dd>{`Operador ${details.openedBy.slice(0, 8)}`}</dd></div>
      <div><dt>Fechado por</dt><dd>{details.closedBy ? `Operador ${details.closedBy.slice(0, 8)}` : '—'}</dd></div>
      <div><dt>Dinheiro esperado</dt><dd>{formatCents(details.expectedCashCents ?? details.totals.expectedCashCents)}</dd></div>
      <div><dt>Dinheiro contado</dt><dd>{formatCents(details.countedCashCents ?? 0)}</dd></div>
      <div><dt>Diferença</dt><dd className={difference ? 'is-different' : ''}>{difference === null ? '—' : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatCents(Math.abs(difference))}`}</dd></div>
      <div><dt>Vendas de consumo</dt><dd>{formatCents(details.totals.consumptionSalesCents)}</dd></div>
      <div><dt>Gorjetas brutas</dt><dd>{formatCents(details.totals.grossTipsCents)}</dd></div>
      <div><dt>Recebido / estornado</dt><dd>{formatCents(details.totals.receivedCents)} / {formatCents(details.totals.refundedCents)}</dd></div>
    </dl>
    {details.differenceReason ? <p className="tv-finance-audit-reason"><strong>Motivo da diferença:</strong> {details.differenceReason}</p> : null}
    {details.exceptionReason ? <p className="tv-finance-audit-reason is-exception"><strong>Fechamento excepcional:</strong> {details.exceptionReason}</p> : null}
    {details.methods.length ? <div className="tv-finance-history-methods"><strong>Por forma de pagamento</strong>{details.methods.map((method) => <span key={method.methodId}>{method.methodName}: {formatCents(method.receivedCents)} recebido · {formatCents(method.refundedCents)} estornado</span>)}</div> : null}
    {details.movements.length ? <div className="tv-finance-history-methods"><strong>Suprimentos e sangrias</strong>{details.movements.map((movement) => <span key={movement.id}>{movement.type === 'replenishment' ? 'Suprimento' : 'Sangria'} · {formatCents(movement.amountCents)} · {movement.reason}</span>)}</div> : null}
    {details.carriedAccounts.length ? <div className="tv-finance-history-methods"><strong>Saldos transportados no fechamento</strong>{details.carriedAccounts.map((account) => <span key={account.accountId}>Mesa {account.tableNumber}: {formatCents(account.balanceAtCloseCents)} · {account.currentStatus === 'pending' ? 'em recebimento' : 'quitada'}</span>)}</div> : null}
    {details.pendingReceivables.length ? <PendingReceivables restaurantId={restaurantId} accounts={details.pendingReceivables} timezone={timezone} /> : null}
  </>
}
