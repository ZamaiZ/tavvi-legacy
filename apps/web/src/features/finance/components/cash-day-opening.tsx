'use client'

import { useState, type FormEvent } from 'react'
import { LuCircleDollarSign, LuCoins } from 'react-icons/lu'
import type { DenominationCount, FinanceDashboardDTO } from '@/domain/finance'
import { digitsToCents, formatCents, formatCentsInput } from '@/lib/money'
import { openCashDayAction } from '@/server/actions/finance'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { CashDenominationCounter, denominationTotal } from './cash-denomination-counter'
import { useFinanceMutation } from './use-finance-mutation'

export function CashDayOpening({ restaurantId, onUpdated }: {
  restaurantId: string
  onUpdated: (dashboard: FinanceDashboardDTO) => void
}) {
  const [mode, setMode] = useState<'total' | 'count'>('total')
  const [amount, setAmount] = useState('0,00')
  const [counts, setCounts] = useState<DenominationCount>({})
  const mutation = useFinanceMutation(onUpdated)
  const countedCents = mode === 'count' ? denominationTotal(counts) : null
  const openingCashCents = countedCents ?? digitsToCents(amount)
  const canOpen = openingCashCents !== null && openingCashCents <= 2_147_483_647

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (openingCashCents === null || openingCashCents > 2_147_483_647) return
    mutation.submit(openCashDayAction, {
      restaurantId,
      openingCashCents,
      openingCount: mode === 'count' ? counts : null,
    })
  }

  return <section className="tv-finance-opening tv-finance-card" aria-labelledby="tv-finance-opening-title">
    <div className="tv-finance-section-heading">
      <span className="tv-finance-icon"><LuCircleDollarSign aria-hidden="true" /></span>
      <div><p>INÍCIO DA OPERAÇÃO</p><h2 id="tv-finance-opening-title">Abrir caixa do restaurante</h2>
        <small>Registre o dinheiro que ficará disponível para troco. A abertura inicia um novo período de caixa.</small>
      </div>
    </div>
    <form onSubmit={submit}>
      <div className="tv-finance-mode-tabs" role="group" aria-label="Como informar o fundo inicial">
        <button type="button" className={mode === 'total' ? 'is-active' : ''} aria-pressed={mode === 'total'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('total'); mutation.clearError() }}>
          <LuCircleDollarSign aria-hidden="true" />Informar total
        </button>
        <button type="button" className={mode === 'count' ? 'is-active' : ''} aria-pressed={mode === 'count'} disabled={mutation.busy || mutation.locked} onClick={() => { setMode('count'); mutation.clearError() }}>
          <LuCoins aria-hidden="true" />Contar notas e moedas
        </button>
      </div>
      {mode === 'total' ? <label className="tv-finance-field tv-finance-opening-amount">
        <span>Fundo inicial em espécie</span>
        <span className="tv-finance-money-input"><b>R$</b><input inputMode="numeric" value={amount} disabled={mutation.busy || mutation.locked}
          onChange={(event) => { setAmount(event.target.value); mutation.clearError() }}
          onBlur={() => { const cents = digitsToCents(amount); if (cents !== null) setAmount(formatCentsInput(cents)) }} /></span>
        <small>Esse valor faz parte do dinheiro esperado no fechamento.</small>
      </label> : <CashDenominationCounter label="Contagem do fundo inicial" counts={counts} disabled={mutation.busy || mutation.locked}
        onChange={(next) => { setCounts(next); mutation.clearError() }} />}
      <div className="tv-finance-opening-footer">
        <p><span>Valor que entrará na gaveta</span><strong>{formatCents(openingCashCents ?? 0)}</strong></p>
        <Button type="submit" size="lg" disabled={!canOpen || mutation.busy}>
          {mutation.busy ? <><SpinnerRing decorative /> Abrindo…</> : mutation.locked ? 'Repetir abertura' : 'Abrir caixa'}
        </Button>
      </div>
      {mutation.error ? <p className="tv-finance-error" role="alert">{mutation.error}</p> : null}
    </form>
  </section>
}
