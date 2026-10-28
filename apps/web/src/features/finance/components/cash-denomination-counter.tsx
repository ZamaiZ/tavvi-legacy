'use client'

import { cashDenominations, type BRLDenomination, type DenominationCount } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { LuCoins } from 'react-icons/lu'

export function denominationTotal(counts: DenominationCount): number {
  return Object.entries(counts).reduce((sum, [denomination, count]) =>
    sum + Math.round(Number(denomination) * 100) * (count ?? 0), 0)
}

export function CashDenominationCounter({
  label,
  counts,
  onChange,
  disabled,
}: {
  label: string
  counts: DenominationCount
  onChange: (counts: DenominationCount, totalCents: number) => void
  disabled?: boolean
}) {
  function change(denomination: BRLDenomination, value: string) {
    const quantity = value === '' ? 0 : Number(value)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) return
    const updated = { ...counts, [denomination]: quantity }
    onChange(updated, denominationTotal(updated))
  }

  return <fieldset className="tv-finance-denominations" disabled={disabled}>
    <legend>{label}</legend>
    <div className="tv-finance-denomination-grid">
      {cashDenominations.map((denomination) => <label key={denomination}>
        <span>R$ {denomination}</span>
        <input inputMode="numeric" type="number" min="0" max="1000000" step="1" value={counts[denomination] ?? 0}
          aria-label={`Quantidade de cédulas ou moedas de R$ ${denomination}`}
          onChange={(event) => change(denomination, event.target.value)} />
      </label>)}
    </div>
    <p className="tv-finance-denomination-total"><span><LuCoins aria-hidden="true" /> Total contado</span><strong>{formatCents(denominationTotal(counts))}</strong></p>
  </fieldset>
}
