'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { LuRotateCcw, LuX } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import type { PaymentMethodDTO, TableAccountDTO } from '@/domain/table-account'
import { digitsToCents, formatCents, formatCentsInput } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { cancelAccountOrderItemAction, reverseAccountPaymentAction } from '@/server/actions/table-accounts'

type PendingCorrection = {
  kind: 'refund'
  paymentId: string
  amountCents: number
  refundMethodId: string
  reason: string
  fingerprint: string
  requestId: string
} | {
  kind: 'cancel'
  orderItemId: string
  reason: string
  fingerprint: string
  requestId: string
}

const MAX_AMOUNT_CENTS = 2_147_483_647

export function AccountCorrections({
  restaurantId,
  account,
  methods,
  role,
  onUpdated,
  onOperationStateChange,
}: {
  restaurantId: string
  account: TableAccountDTO
  methods: PaymentMethodDTO[]
  role: MemberRole
  onUpdated: (account: TableAccountDTO) => void
  onOperationStateChange: (state: 'idle' | 'busy' | 'uncertain') => void
}) {
  const [refundId, setRefundId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [amountText, setAmountText] = useState('')
  const [refundMethodId, setRefundMethodId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingRetry, setPendingRetry] = useState<PendingCorrection | null>(null)
  const [busy, startTransition] = useTransition()
  const requestIds = useRef(new Map<string, string>())
  const refundable = (paymentId: string, amount: number) => Math.max(amount - account.payments
    .filter((entry) => entry.entryType === 'refunded' && entry.reversesPaymentId === paymentId)
    .reduce((sum, entry) => sum + entry.amountAppliedCents, 0), 0)

  function openRefund(paymentId: string, available: number) {
    if (pendingRetry) return
    setRefundId(paymentId)
    setCancelId(null)
    setAmountText(formatCentsInput(available))
    setRefundMethodId(account.payments.find((payment) => payment.id === paymentId)?.methodId ?? '')
    setReason('')
    setError(null)
  }

  function submitRefund(paymentId: string) {
    const retry = pendingRetry?.kind === 'refund' && pendingRetry.paymentId === paymentId ? pendingRetry : null
    if (pendingRetry && !retry) return
    const amountCents = retry?.amountCents ?? digitsToCents(amountText)
    const actualMethodId = retry?.refundMethodId ?? refundMethodId
    const normalizedReason = retry?.reason ?? reason.trim()
    if (!amountCents || amountCents > MAX_AMOUNT_CENTS || !actualMethodId || normalizedReason.length < 3) return
    const fingerprint = retry?.fingerprint ?? JSON.stringify({ paymentId, amountCents, refundMethodId: actualMethodId, reason: normalizedReason })
    const requestId = retry?.requestId ?? requestIds.current.get(fingerprint) ?? crypto.randomUUID()
    requestIds.current.set(fingerprint, requestId)
    const operation: PendingCorrection = { kind: 'refund', paymentId, amountCents, refundMethodId: actualMethodId, reason: normalizedReason, fingerprint, requestId }
    onOperationStateChange('busy')
    startTransition(async () => {
      try {
        const result = await reverseAccountPaymentAction({ restaurantId, paymentId, amountCents, refundMethodId: actualMethodId, reason: normalizedReason, requestId })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitiveCorrectionRejection(result.error)) {
            setPendingRetry(null)
            requestIds.current.delete(fingerprint)
            onOperationStateChange('idle')
          } else {
            setPendingRetry(operation)
            onOperationStateChange('uncertain')
          }
          return
        }
        setPendingRetry(null)
        onOperationStateChange('idle')
        onUpdated(result.data)
        setRefundId(null)
        setReason('')
        requestIds.current.delete(fingerprint)
      } catch {
        setPendingRetry(operation)
        onOperationStateChange('uncertain')
        setError('Não foi possível confirmar o estorno. Tente novamente sem alterar os dados.')
      }
    })
  }

  function submitCancel(orderItemId: string) {
    const retry = pendingRetry?.kind === 'cancel' && pendingRetry.orderItemId === orderItemId ? pendingRetry : null
    if (pendingRetry && !retry) return
    const normalizedReason = retry?.reason ?? reason.trim()
    if (normalizedReason.length < 3) return
    const fingerprint = retry?.fingerprint ?? JSON.stringify({ orderItemId, reason: normalizedReason })
    const requestId = retry?.requestId ?? requestIds.current.get(fingerprint) ?? crypto.randomUUID()
    requestIds.current.set(fingerprint, requestId)
    const operation: PendingCorrection = { kind: 'cancel', orderItemId, reason: normalizedReason, fingerprint, requestId }
    onOperationStateChange('busy')
    startTransition(async () => {
      try {
        const result = await cancelAccountOrderItemAction({ restaurantId, orderItemId, reason: normalizedReason, requestId })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitiveCorrectionRejection(result.error)) {
            setPendingRetry(null)
            requestIds.current.delete(fingerprint)
            onOperationStateChange('idle')
          } else {
            setPendingRetry(operation)
            onOperationStateChange('uncertain')
          }
          return
        }
        setPendingRetry(null)
        onOperationStateChange('idle')
        onUpdated(result.data)
        setCancelId(null)
        setReason('')
        requestIds.current.delete(fingerprint)
      } catch {
        setPendingRetry(operation)
        onOperationStateChange('uncertain')
        setError('Não foi possível confirmar o cancelamento. Tente novamente com o mesmo motivo.')
      }
    })
  }

  const receivedPayments = account.payments.filter((payment) => payment.entryType === 'received')
  const cancellableItems = account.orders.flatMap((order) => order.items.filter((item) => !item.cancelledAt || cancelId === item.id).map((item) => ({ item, order })))

  return <div className="tv-cash-corrections">
    <section className="tv-cash-correction-card" aria-labelledby="tv-cash-refunds-title">
      <header><span className="tv-cash-correction-icon is-refund"><LuRotateCcw aria-hidden="true" /></span><div><strong id="tv-cash-refunds-title">Estornos</strong><small>Os recebimentos originais permanecem no histórico.</small></div></header>
      {receivedPayments.map((payment) => {
        const available = refundable(payment.id, payment.amountAppliedCents)
        const refundRetry = pendingRetry?.kind === 'refund' && pendingRetry.paymentId === payment.id ? pendingRetry : null
        const retryingRefund = refundRetry !== null
        const enteredAmount = digitsToCents(amountText)
        const amountTooLarge = enteredAmount !== null && enteredAmount > MAX_AMOUNT_CENTS
        if (!available && refundId !== payment.id) return null
        return <div className="tv-cash-correction-row" key={payment.id}>
          <div className="tv-cash-correction-summary"><span><strong>{payment.methodName}</strong><small>Recebido {formatCents(payment.amountAppliedCents)} · disponível para estorno {formatCents(available)}</small></span>
            {refundId === payment.id ? <div className="tv-cash-correction-form">
              <label>Valor a estornar<input inputMode="numeric" value={refundRetry ? formatCentsInput(refundRetry.amountCents) : amountText} disabled={busy || pendingRetry !== null} onChange={(event) => setAmountText(event.target.value)} onBlur={() => { const value = digitsToCents(amountText); if (value !== null && value <= MAX_AMOUNT_CENTS) setAmountText(formatCentsInput(value)) }} />{amountTooLarge ? <small className="tv-cash-field-hint is-error">O valor excede o limite permitido.</small> : null}</label>
              <label>Devolver por<select value={refundRetry?.refundMethodId ?? refundMethodId} disabled={busy || pendingRetry !== null} onChange={(event) => setRefundMethodId(event.target.value)}>{methods.filter((method) => method.isActive || method.id === payment.methodId || method.id === refundMethodId).map((method) => <option key={method.id} value={method.id}>{method.name}{method.isActive ? '' : ' · inativa (histórico)'}</option>)}</select></label>
              <label>Motivo<textarea value={refundRetry?.reason ?? reason} disabled={busy || pendingRetry !== null} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do estorno" /></label>
              <div><button type="button" disabled={busy || (!retryingRefund && (!enteredAmount || enteredAmount > MAX_AMOUNT_CENTS || enteredAmount > available || reason.trim().length < 3 || !refundMethodId))} onClick={() => submitRefund(payment.id)}>{busy ? <SpinnerRing decorative /> : null}{retryingRefund ? 'Repetir estorno' : 'Registrar estorno'}</button><button type="button" className="tv-cash-correction-cancel" disabled={busy || pendingRetry !== null} onClick={() => setRefundId(null)}>Cancelar</button></div>
            </div> : <button type="button" disabled={busy || pendingRetry !== null} onClick={() => openRefund(payment.id, available)}>Estornar</button>}
          </div>
        </div>
      })}
      {!receivedPayments.some((payment) => refundable(payment.id, payment.amountAppliedCents) > 0) ? <p className="tv-cash-correction-empty">Nenhum recebimento está disponível para estorno.</p> : null}
    </section>

    <section className="tv-cash-correction-card" aria-labelledby="tv-cash-cancellations-title">
      <header><span className="tv-cash-correction-icon is-cancel"><LuX aria-hidden="true" /></span><div><strong id="tv-cash-cancellations-title">Cancelamento de itens</strong><small>Os itens cancelados permanecem registrados na conta.</small></div></header>
      {role === 'admin' && (account.status === 'open' || pendingRetry?.kind === 'cancel') ? cancellableItems.length ? cancellableItems.map(({ item, order }) => {
        const cancelRetry = pendingRetry?.kind === 'cancel' && pendingRetry.orderItemId === item.id ? pendingRetry : null
        const retryingCancel = cancelRetry !== null
        return <div className="tv-cash-correction-row" key={item.id}>
        <div className="tv-cash-correction-summary"><span><strong>{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</strong><small>{formatCents(item.lineTotalCents)} · pedido {order.id.slice(0, 8)}</small></span>
          {cancelId === item.id ? <div className="tv-cash-correction-form">
            <label>Motivo do cancelamento<textarea value={cancelRetry?.reason ?? reason} disabled={busy || pendingRetry !== null} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do cancelamento" /></label>
            <div><button type="button" disabled={busy || (!retryingCancel && reason.trim().length < 3)} onClick={() => submitCancel(item.id)}>{busy ? <SpinnerRing decorative /> : null}{retryingCancel ? 'Repetir cancelamento' : 'Confirmar cancelamento'}</button><button type="button" className="tv-cash-correction-cancel" disabled={busy || pendingRetry !== null} onClick={() => setCancelId(null)}>Voltar</button></div>
          </div> : <button type="button" disabled={busy || pendingRetry !== null} onClick={() => { setCancelId(item.id); setRefundId(null); setReason(''); setError(null) }}>Cancelar item</button>}
        </div>
      </div>
      }) : <p className="tv-cash-correction-empty">Todos os itens desta comanda já foram cancelados.</p> : <p className="tv-cash-correction-empty">{role === 'admin' ? 'O cancelamento de itens fica disponível enquanto a comanda está aberta.' : 'O cancelamento de itens está disponível apenas para a administração.'}</p>}
    </section>

    {pendingRetry ? <p className="tv-cash-inline-hint" role="status">A resposta anterior ficou incerta. Repita a mesma correção antes de iniciar outra.</p> : null}
    {error ? <p className="tv-cash-inline-error" role="alert">{error}{error.includes('página Financeiro') ? <> <Link href={`/restaurantes/${restaurantId}/financeiro`}>Abrir Financeiro</Link></> : null}</p> : null}
  </div>
}

function isDefinitiveCorrectionRejection(message: string): boolean {
  return [
    'Apenas o caixa e a administração',
    'Somente a administração',
    'Você não tem permissão para esta operação',
    'A comanda não foi encontrada',
    'A comanda já foi encerrada',
    'Esta comanda não aceita essa alteração',
    'Esta comanda não está em processo de fechamento',
    'O estorno excede o valor líquido do recebimento original',
    'Estorne valores suficientes antes de cancelar este item',
    'Este item já foi cancelado',
    'O recebimento não está disponível neste restaurante',
    'Abra o caixa na página Financeiro',
    'O item não está disponível neste restaurante',
    'O pedido não está disponível neste restaurante',
  ].some((knownMessage) => message.includes(knownMessage))
}
