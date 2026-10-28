'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { LuTriangleAlert, LuCircleCheck, LuLockKeyhole } from 'react-icons/lu'
import type { DenominationCount, FinanceDashboardDTO } from '@/domain/finance'
import type { MemberRole } from '@/domain/invite'
import { digitsToCents, formatCents, formatCentsInput } from '@/lib/money'
import { closeCashDayAction } from '@/server/actions/finance'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { CashDenominationCounter, denominationTotal } from './cash-denomination-counter'
import { useFinanceMutation } from './use-finance-mutation'

export function CashDayClosing({
  restaurantId,
  dashboard,
  role,
  onUpdated,
}: {
  restaurantId: string
  dashboard: FinanceDashboardDTO
  role: MemberRole
  onUpdated: (dashboard: FinanceDashboardDTO) => void
}) {
  const day = dashboard.activeDay
  const blockers = dashboard.accountsBlockingClose
  const [mode, setMode] = useState<'total' | 'count'>('total')
  const [amount, setAmount] = useState(formatCentsInput(dashboard.totals.expectedCashCents))
  const [amountEdited, setAmountEdited] = useState(false)
  const [counts, setCounts] = useState<DenominationCount>({})
  const [differenceReason, setDifferenceReason] = useState('')
  const [exceptionReason, setExceptionReason] = useState('')
  const [exception, setException] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const mutation = useFinanceMutation(onUpdated)
  useEffect(() => {
    if (!amountEdited) setAmount(formatCentsInput(dashboard.totals.expectedCashCents))
  }, [amountEdited, dashboard.totals.expectedCashCents])
  if (!day) return null
  const cashDayId = day.id

  const countedCents = mode === 'count' ? denominationTotal(counts) : digitsToCents(amount)
  const difference = countedCents === null ? null : countedCents - dashboard.totals.expectedCashCents
  const requiresDifferenceReason = difference !== null && difference !== 0
  const canClose = countedCents !== null && countedCents >= 0 && countedCents <= 2_147_483_647
    && (!requiresDifferenceReason || differenceReason.trim().length >= 3)
    && (!blockers.length || (role === 'admin' && exception && exceptionReason.trim().length >= 3 && confirmed))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canClose || countedCents === null) return
    mutation.submit(closeCashDayAction, {
      restaurantId,
      cashDayId,
      countedCashCents: countedCents,
      closingCount: mode === 'count' ? counts : null,
      differenceReason: requiresDifferenceReason ? differenceReason.trim() : null,
      exceptionReason: blockers.length && exception ? exceptionReason.trim() : null,
    })
  }

  return <section className="tv-finance-card tv-finance-closing" aria-labelledby="tv-finance-closing-title">
    <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuLockKeyhole aria-hidden="true" /></span><div><p>FIM DO PERÍODO</p><h2 id="tv-finance-closing-title">Conferir e fechar caixa</h2>
      <small>Conte todo o dinheiro físico da gaveta, incluindo o fundo inicial. O sistema compara com o valor esperado.</small>
    </div></div>

    {blockers.length ? <div className="tv-finance-blockers" role="note">
      <div><LuTriangleAlert aria-hidden="true" /><strong>{blockers.length === 1 ? 'Uma comanda impede o fechamento normal' : `${blockers.length} comandas impedem o fechamento normal`}</strong></div>
      <p>Finalize as comandas antes de fechar. Se a operação exigir, a administração pode encerrar excepcionalmente; os saldos restantes ficam como pendências e as mesas são liberadas.</p>
      <ul>{blockers.map((account) => <li key={account.accountId}><span>Mesa {account.tableNumber}</span><b>{formatCents(account.balanceDueCents)} pendente</b></li>)}</ul>
      {role === 'admin' ? <label className="tv-finance-exception-toggle"><input type="checkbox" checked={exception} disabled={mutation.busy || mutation.locked}
        onChange={(event) => { setException(event.target.checked); setConfirmed(false); mutation.clearError() }} /> Fechar excepcionalmente e transportar os saldos como pendências</label>
        : <p className="tv-finance-admin-note">A exceção só pode ser autorizada pela administração.</p>}
      {role === 'admin' && exception ? <div className="tv-finance-exception-form">
        <label>Justificativa obrigatória<textarea value={exceptionReason} disabled={mutation.busy || mutation.locked} maxLength={500} placeholder="Explique por que o caixa precisa ser fechado com comandas pendentes"
          onChange={(event) => { setExceptionReason(event.target.value); mutation.clearError() }} /></label>
        <label className="tv-finance-confirm-exception"><input type="checkbox" checked={confirmed} disabled={mutation.busy || mutation.locked || exceptionReason.trim().length < 3}
          onChange={(event) => setConfirmed(event.target.checked)} /> Confirmo que {blockers.length} saldo(s) serão transferidos para recebimento posterior.</label>
      </div> : null}
    </div> : null}

    <form onSubmit={submit}>
      <div className="tv-finance-closing-expected"><span>Dinheiro esperado no fechamento</span><strong>{formatCents(dashboard.totals.expectedCashCents)}</strong></div>
      <div className="tv-finance-mode-tabs" role="group" aria-label="Como informar a contagem final">
        <button type="button" className={mode === 'total' ? 'is-active' : ''} aria-pressed={mode === 'total'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('total'); mutation.clearError() }}>Informar total</button>
        <button type="button" className={mode === 'count' ? 'is-active' : ''} aria-pressed={mode === 'count'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('count'); mutation.clearError() }}>Contar notas e moedas</button>
      </div>
      {mode === 'total' ? <label className="tv-finance-field tv-finance-counted-input">
        <span>Dinheiro contado</span><span className="tv-finance-money-input"><b>R$</b><input inputMode="numeric" value={amount} disabled={mutation.busy || mutation.locked}
          onChange={(event) => { setAmount(event.target.value); setAmountEdited(true); mutation.clearError() }}
          onBlur={() => { const cents = digitsToCents(amount); if (cents !== null) setAmount(formatCentsInput(cents)) }} /></span>
      </label> : <CashDenominationCounter label="Contagem final do dinheiro" counts={counts} disabled={mutation.busy || mutation.locked}
        onChange={(next) => { setCounts(next); mutation.clearError() }} />}
      <div className={`tv-finance-difference${requiresDifferenceReason ? ' is-different' : ''}`}>
        <span>Diferença de caixa</span><strong>{difference === null ? '—' : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatCents(Math.abs(difference))}`}</strong>
        <small>{difference === null ? 'Informe a contagem.' : difference === 0 ? 'A contagem confere com o esperado.' : difference > 0 ? 'Há mais dinheiro contado do que o esperado.' : 'Há menos dinheiro contado do que o esperado.'}</small>
      </div>
      {requiresDifferenceReason ? <label className="tv-finance-field">Motivo da diferença<textarea value={differenceReason} disabled={mutation.busy || mutation.locked} maxLength={500}
        placeholder="Registre o motivo para deixar uma trilha de conferência" onChange={(event) => { setDifferenceReason(event.target.value); mutation.clearError() }} /></label> : null}
      {mutation.error ? <p className="tv-finance-error" role="alert">{mutation.error}</p> : null}
      <Button type="submit" size="lg" variant={blockers.length && exception ? 'destructive' : 'default'} disabled={!canClose || mutation.busy}>
        {mutation.busy ? <><SpinnerRing decorative /> Fechando…</> : mutation.locked ? 'Repetir fechamento' : <><LuCircleCheck aria-hidden="true" /> {blockers.length && exception ? 'Confirmar fechamento excepcional' : 'Fechar caixa'}</>}
      </Button>
    </form>
  </section>
}
