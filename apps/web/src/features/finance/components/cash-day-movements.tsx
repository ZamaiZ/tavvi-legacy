'use client'

import { useState, type FormEvent } from 'react'
import { LuArrowDownLeft, LuArrowUpRight, LuCirclePlus, LuVault } from 'react-icons/lu'
import type { CashDayMovementDTO, FinanceDashboardDTO } from '@/domain/finance'
import { digitsToCents, formatCents } from '@/lib/money'
import { recordCashDayMovementAction } from '@/server/actions/finance'
import { Button } from '@/components/ui/button'
import { SpinnerRing } from '@/components/ui/spinner'
import { useFinanceMutation } from './use-finance-mutation'
import { formatRestaurantDateTime } from './finance-time'

export function CashDayMovements({ restaurantId, cashDayId, movements, timezone, onUpdated }: {
  restaurantId: string
  cashDayId: string
  movements: CashDayMovementDTO[]
  timezone: string
  onUpdated: (dashboard: FinanceDashboardDTO) => void
}) {
  const [type, setType] = useState<'replenishment' | 'withdrawal'>('replenishment')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const mutation = useFinanceMutation(onUpdated)
  const amountCents = digitsToCents(amount)
  const ready = amountCents !== null && amountCents > 0 && amountCents <= 2_147_483_647 && reason.trim().length >= 3

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || amountCents === null) return
    mutation.submit(recordCashDayMovementAction, { restaurantId, cashDayId, type, amountCents, reason: reason.trim() })
  }

  return <section className="tv-finance-card tv-finance-movement-section" aria-labelledby="tv-finance-movements-title">
    <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuVault aria-hidden="true" /></span><div><p>CONTROLE DA GAVETA</p><h2 id="tv-finance-movements-title">Movimentações de dinheiro</h2>
      <small>Reforço e retirada de espécie alteram o valor esperado, mas não são receita nem despesa operacional.</small>
    </div></div>
    <form className="tv-finance-movement-form" onSubmit={submit}>
      <label>Tipo de movimentação<select value={type} disabled={mutation.busy || mutation.locked} onChange={(event) => { setType(event.target.value as typeof type); mutation.clearError() }}>
        <option value="replenishment">Suprimento · reforçar o troco</option>
        <option value="withdrawal">Sangria · retirar para o cofre</option>
      </select></label>
      <label>Valor<span className="tv-finance-money-input"><b>R$</b><input inputMode="numeric" value={amount} disabled={mutation.busy || mutation.locked} placeholder="0,00"
        onChange={(event) => { setAmount(event.target.value); mutation.clearError() }} /></span></label>
      <label className="tv-finance-reason-field">Motivo<input value={reason} disabled={mutation.busy || mutation.locked} maxLength={500} placeholder={type === 'replenishment' ? 'Ex.: reforço para troco' : 'Ex.: retirada para cofre'}
        onChange={(event) => { setReason(event.target.value); mutation.clearError() }} /></label>
      <Button type="submit" size="lg" disabled={!ready || mutation.busy}>{mutation.busy ? <><SpinnerRing decorative /> Registrando…</> : mutation.locked ? 'Repetir movimentação' : <><LuCirclePlus aria-hidden="true" /> Registrar</>}</Button>
    </form>
    {mutation.error ? <p className="tv-finance-error" role="alert">{mutation.error}</p> : null}
    <div className="tv-finance-movement-list">
      <h3>Movimentações deste caixa <span>{movements.length}</span></h3>
      {movements.length ? movements.map((movement) => <MovementRow key={movement.id} movement={movement} timezone={timezone} />)
        : <p className="tv-finance-empty-inline">Nenhum suprimento ou sangria registrado neste período.</p>}
    </div>
  </section>
}

function MovementRow({ movement, timezone }: { movement: CashDayMovementDTO; timezone: string }) {
  const replenishment = movement.type === 'replenishment'
  return <article className="tv-finance-movement-row">
    <span className={`tv-finance-movement-icon${replenishment ? ' is-in' : ' is-out'}`}>
      {replenishment ? <LuArrowDownLeft aria-hidden="true" /> : <LuArrowUpRight aria-hidden="true" />}
    </span>
    <div><strong>{replenishment ? 'Suprimento' : 'Sangria'}</strong><small>{movement.reason} · {formatRestaurantDateTime(movement.createdAt, timezone, { dateStyle: 'short', timeStyle: 'short' })} · operador {movement.createdBy.slice(0, 8)}</small></div>
    <b className={replenishment ? 'is-in' : 'is-out'}>{replenishment ? '+' : '−'}{formatCents(movement.amountCents)}</b>
  </article>
}
