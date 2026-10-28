'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { LuBanknote, LuCircleCheck, LuLockKeyhole, LuReceiptText, LuTriangleAlert } from 'react-icons/lu'
import type { DenominationCount, FinanceDashboardDTO } from '@/domain/finance'
import { formatTableAccountIdentity } from '@/domain/table-account'
import type { MemberRole } from '@/domain/invite'
import { formatCents } from '@/lib/money'
import { closeCashDayAction } from '@/server/actions/finance'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SpinnerRing } from '@/components/ui/spinner'
import { CashDenominationCounter, denominationTotal } from './cash-denomination-counter'
import { useFinanceMutation } from './use-finance-mutation'

export function CashDayClosing({
  restaurantId,
  dashboard,
  role,
  onUpdated,
  onBusyChange,
}: {
  restaurantId: string
  dashboard: FinanceDashboardDTO
  role: MemberRole
  onUpdated: (dashboard: FinanceDashboardDTO) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const day = dashboard.activeDay
  const blockers = dashboard.accountsBlockingClose
  const [mode, setMode] = useState<'total' | 'count'>('total')
  const [amount, setAmount] = useState<number | null>(dashboard.totals.expectedCashCents)
  const [amountEdited, setAmountEdited] = useState(false)
  const [counts, setCounts] = useState<DenominationCount>({})
  const [differenceReason, setDifferenceReason] = useState('')
  const [exceptionReason, setExceptionReason] = useState('')
  const [exception, setException] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const mutation = useFinanceMutation(onUpdated)
  useEffect(() => { onBusyChange?.(mutation.busy || mutation.locked) }, [mutation.busy, mutation.locked, onBusyChange])
  useEffect(() => {
    if (!amountEdited) setAmount(dashboard.totals.expectedCashCents)
  }, [amountEdited, dashboard.totals.expectedCashCents])
  if (!day) return null
  const cashDayId = day.id

  const countedCents = mode === 'count' ? denominationTotal(counts) : amount
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

    {blockers.length ? <section className="tv-finance-blockers" role="note" aria-labelledby="tv-finance-blockers-title">
      <div className="tv-finance-blockers-heading">
        <span className="tv-finance-blockers-icon"><LuTriangleAlert aria-hidden="true" /></span>
        <span><small>FECHAMENTO COM PENDÊNCIAS</small><strong id="tv-finance-blockers-title">
          {blockers.length === 1 ? 'Uma comanda impede o fechamento normal' : `${blockers.length} comandas impedem o fechamento normal`}
        </strong></span>
        <b className="tv-finance-blockers-count">{blockers.length} {blockers.length === 1 ? 'saldo' : 'saldos'}</b>
      </div>
      <p>Finalize estas comandas para fechar normalmente. Se a operação exigir, a administração pode transportar os saldos como pendências e liberar as mesas.</p>
      <ul>{blockers.map((account) => <li key={account.accountId}>
        <span className="tv-finance-blocker-account-icon"><LuReceiptText aria-hidden="true" /></span>
        <span className="tv-finance-blocker-account"><strong>{formatTableAccountIdentity(account)}</strong><small>Saldo que ficará disponível para recebimento posterior</small></span>
        <b>{formatCents(account.balanceDueCents)}</b>
      </li>)}</ul>
      {role === 'admin' ? <label className="tv-finance-exception-toggle">
        <input type="checkbox" checked={exception} disabled={mutation.busy || mutation.locked}
          onChange={(event) => { setException(event.target.checked); setConfirmed(false); mutation.clearError() }} />
        <span><strong>Fechar excepcionalmente</strong><small>Transportar os saldos listados e liberar as mesas após o fechamento.</small></span>
      </label> : <p className="tv-finance-admin-note">O fechamento excepcional só pode ser autorizado pela administração.</p>}
      {role === 'admin' ? <div className={`tv-finance-exception-reveal${exception ? ' is-open' : ''}`} aria-hidden={!exception} inert={!exception}>
        <div className="tv-finance-exception-reveal-inner">
          <div className="tv-finance-exception-form">
            <div className="tv-finance-exception-heading"><LuReceiptText aria-hidden="true" /><span><strong>Justificativa e confirmação</strong><small>Esta informação ficará registrada na trilha de auditoria.</small></span></div>
            <label>Justificativa obrigatória<textarea value={exceptionReason} disabled={mutation.busy || mutation.locked} maxLength={500} placeholder="Explique por que o caixa precisa ser fechado com comandas pendentes"
              onChange={(event) => { setExceptionReason(event.target.value); mutation.clearError() }} /></label>
            <label className="tv-finance-confirm-exception"><input type="checkbox" checked={confirmed} disabled={mutation.busy || mutation.locked || exceptionReason.trim().length < 3}
              onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo que {blockers.length} {blockers.length === 1 ? 'saldo será transferido' : 'saldos serão transferidos'} para recebimento posterior.</span></label>
          </div>
        </div>
      </div> : null}
    </section> : null}

    <form onSubmit={submit}>
      <div className="tv-finance-closing-expected">
        <span className="tv-finance-closing-expected-icon"><LuBanknote aria-hidden="true" /></span>
        <span className="tv-finance-closing-expected-copy"><small>BASE DE CONFERÊNCIA</small><span>Dinheiro esperado no fechamento</span></span>
        <strong>{formatCents(dashboard.totals.expectedCashCents)}</strong>
      </div>
      <div className="tv-finance-mode-tabs" role="group" aria-label="Como informar a contagem final">
        <button type="button" className={mode === 'total' ? 'is-active' : ''} aria-pressed={mode === 'total'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('total'); mutation.clearError() }}>Informar total</button>
        <button type="button" className={mode === 'count' ? 'is-active' : ''} aria-pressed={mode === 'count'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('count'); mutation.clearError() }}>Contar notas e moedas</button>
      </div>
      {mode === 'total' ? <label className="tv-finance-field tv-finance-counted-input">
        <span>Dinheiro contado</span><span className="tv-finance-money-input"><b>R$</b><CurrencyInput valueCents={amount} maxCents={2_147_483_647}
          aria-label="Dinheiro contado, em reais" disabled={mutation.busy || mutation.locked}
          onValueChange={(cents) => { setAmount(cents); setAmountEdited(true); mutation.clearError() }} /></span>
      </label> : <CashDenominationCounter label="Contagem final do dinheiro" counts={counts} disabled={mutation.busy || mutation.locked}
        onChange={(next) => { setCounts(next); mutation.clearError() }} />}
      <div className={`tv-finance-difference${requiresDifferenceReason ? ' is-different' : ''}${difference === null ? ' is-pending' : ''}`}>
        <span className="tv-finance-difference-icon">{requiresDifferenceReason ? <LuTriangleAlert aria-hidden="true" /> : difference === 0 ? <LuCircleCheck aria-hidden="true" /> : <LuBanknote aria-hidden="true" />}</span>
        <span className="tv-finance-difference-copy"><strong>Diferença de caixa</strong>
          <small>{difference === null ? 'Informe a contagem.' : difference === 0 ? 'A contagem confere com o esperado.' : difference > 0 ? 'Há mais dinheiro contado do que o esperado.' : 'Há menos dinheiro contado do que o esperado.'}</small>
        </span>
        <b>{difference === null ? '—' : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatCents(Math.abs(difference))}`}</b>
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
