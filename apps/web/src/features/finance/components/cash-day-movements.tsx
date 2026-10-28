'use client'

import { useState, type FormEvent } from 'react'
import { LuArrowDownLeft, LuArrowUpRight, LuBanknote, LuCircleCheck, LuCirclePlus, LuClock3, LuVault } from 'react-icons/lu'
import type { CashDayMovementDTO, FinanceDashboardDTO } from '@/domain/finance'
import { formatCents } from '@/lib/money'
import { recordCashDayMovementAction } from '@/server/actions/finance'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SpinnerRing } from '@/components/ui/spinner'
import { useFinanceMutation } from './use-finance-mutation'
import { formatRestaurantDateTime } from './finance-time'

export function CashDayMovements({ restaurantId, cashDayId, movements, expectedCashCents, timezone, onUpdated }: {
  restaurantId: string
  cashDayId: string
  movements: CashDayMovementDTO[]
  expectedCashCents: number
  timezone: string
  onUpdated: (dashboard: FinanceDashboardDTO) => void
}) {
  const [type, setType] = useState<'replenishment' | 'withdrawal'>('replenishment')
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState(false)
  const mutation = useFinanceMutation(onUpdated, {
    onSuccess: () => {
      setAmount(null)
      setReason('')
      setSaved(true)
    },
  })
  const amountCents = amount
  const ready = amountCents !== null && amountCents > 0 && amountCents <= 2_147_483_647 && reason.trim().length >= 3

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || amountCents === null) return
    mutation.submit(recordCashDayMovementAction, { restaurantId, cashDayId, type, amountCents, reason: reason.trim() })
  }

  return <div className="tv-finance-operation-layout">
    <section className="tv-finance-card tv-finance-movement-section" aria-labelledby="tv-finance-movements-title">
      <div className="tv-finance-section-heading compact"><span className="tv-finance-icon"><LuVault aria-hidden="true" /></span><div><p>CONTROLE DA GAVETA</p><h2 id="tv-finance-movements-title">Movimentações de dinheiro</h2>
        <small>Reforço e sangria alteram o valor esperado, mas não são receita nem despesa operacional.</small>
      </div></div>
      <form className="tv-finance-movement-form" onSubmit={submit}>
        <div className="tv-finance-movement-field tv-finance-movement-type">
          <span>Tipo de movimentação</span>
          <Combobox
            label="Tipo de movimentação"
            id="tv-finance-movement-type"
            value={type}
            options={[
              { value: 'replenishment', label: 'Reforço' },
              { value: 'withdrawal', label: 'Sangria' },
            ]}
            searchPlaceholder="Buscar movimentação"
            emptyText="Nenhum tipo encontrado."
            disabled={mutation.busy || mutation.locked}
            onValueChange={(value) => {
              setType(value as typeof type)
              setSaved(false)
              mutation.clearError()
            }}
          />
          <small className={`tv-finance-movement-hint${type === 'replenishment' ? ' is-in' : ' is-out'}`}>
            {type === 'replenishment' ? <LuArrowDownLeft aria-hidden="true" /> : <LuArrowUpRight aria-hidden="true" />}
            <span>{type === 'replenishment'
              ? 'Adiciona espécie à gaveta e aumenta o valor esperado.'
              : 'Retira espécie da gaveta e reduz o valor esperado.'}</span>
          </small>
        </div>
        <label className="tv-finance-movement-field">Valor<span className="tv-finance-money-input"><b>R$</b><CurrencyInput
          valueCents={amount}
          maxCents={2_147_483_647}
          aria-label="Valor da movimentação em reais"
          disabled={mutation.busy || mutation.locked}
          onValueChange={(cents) => { setAmount(cents); setSaved(false); mutation.clearError() }}
        /></span></label>
        <label className="tv-finance-movement-field tv-finance-reason-field">Motivo<input value={reason} disabled={mutation.busy || mutation.locked} maxLength={500} placeholder={type === 'replenishment' ? 'Ex.: reforço para troco' : 'Ex.: retirada para cofre'}
          onChange={(event) => { setReason(event.target.value); setSaved(false); mutation.clearError() }} /></label>
        <Button type="submit" size="lg" disabled={!ready || mutation.busy}>{mutation.busy ? <><SpinnerRing decorative /> Registrando…</> : mutation.locked ? 'Repetir movimentação' : <><LuCirclePlus aria-hidden="true" /> Registrar</>}</Button>
      </form>
      {mutation.error ? <p className="tv-finance-error" role="alert">{mutation.error}</p> : null}
      {saved ? <p className="tv-finance-movement-success" role="status"><LuCircleCheck aria-hidden="true" /> Movimentação registrada e saldo esperado atualizado.</p> : null}
      <div className="tv-finance-movement-list">
        <h3>Movimentações deste caixa <span>{movements.length}</span></h3>
        {movements.length ? movements.map((movement) => <MovementRow key={movement.id} movement={movement} timezone={timezone} />)
          : <p className="tv-finance-empty-inline">Nenhum reforço ou sangria registrado neste período.</p>}
      </div>
    </section>
    <aside className="tv-finance-drawer-card" aria-labelledby="tv-finance-drawer-title">
      <span className="tv-finance-drawer-icon"><LuBanknote aria-hidden="true" /></span>
      <div><p className="tv-finance-section-kicker">SALDO ATUAL</p><h2 id="tv-finance-drawer-title">Dinheiro esperado na gaveta</h2></div>
      <strong aria-live="polite">{formatCents(expectedCashCents)}</strong>
      <p>Saldo do período completo: fundo inicial, recebimentos e estornos em dinheiro, suprimentos e sangrias.</p>
    </aside>
  </div>
}

function MovementRow({ movement, timezone }: { movement: CashDayMovementDTO; timezone: string }) {
  const replenishment = movement.type === 'replenishment'
  return <article className="tv-finance-movement-row">
    <span className={`tv-finance-movement-icon${replenishment ? ' is-in' : ' is-out'}`}>
      {replenishment ? <LuArrowDownLeft aria-hidden="true" /> : <LuArrowUpRight aria-hidden="true" />}
    </span>
    <div className="tv-finance-movement-copy">
      <div className="tv-finance-movement-title"><strong>{replenishment ? 'Reforço' : 'Sangria'}</strong><span>{replenishment ? 'Entrada na gaveta' : 'Retirada da gaveta'}</span></div>
      <p>{movement.reason}</p>
      <small><LuClock3 aria-hidden="true" /><time dateTime={movement.createdAt}>{formatRestaurantDateTime(movement.createdAt, timezone, { dateStyle: 'short', timeStyle: 'short' })}</time><span aria-hidden="true">·</span><span>Operador {movement.createdBy.slice(0, 8)}</span></small>
    </div>
    <div className="tv-finance-movement-value"><small>{replenishment ? 'Adicionado' : 'Retirado'}</small><b className={replenishment ? 'is-in' : 'is-out'}>{replenishment ? '+' : '−'}{formatCents(movement.amountCents)}</b></div>
  </article>
}
