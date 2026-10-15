'use client'

import { useRef, useState, useTransition } from 'react'
import type { MemberRole } from '@/domain/invite'
import type { TableAccountDTO } from '@/domain/table-account'
import { digitsToCents, formatCents, formatCentsInput } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { cancelAccountOrderItemAction, reverseAccountPaymentAction } from '@/server/actions/table-accounts'

export function AccountCorrections({
  restaurantId,
  account,
  role,
  onUpdated,
}: {
  restaurantId: string
  account: TableAccountDTO
  role: MemberRole
  onUpdated: (account: TableAccountDTO) => void
}) {
  const [refundId, setRefundId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingRetry, setPendingRetry] = useState<string | null>(null)
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
    setReason('')
    setError(null)
  }

  function submitRefund(paymentId: string) {
    const amountCents = digitsToCents(amountText)
    if (!amountCents || !reason.trim()) return
    const fingerprint = JSON.stringify({ paymentId, amountCents, reason: reason.trim() })
    if (pendingRetry && pendingRetry !== fingerprint) return
    const requestId = requestIds.current.get(fingerprint) ?? crypto.randomUUID()
    requestIds.current.set(fingerprint, requestId)
    startTransition(async () => {
      try {
        const result = await reverseAccountPaymentAction({ restaurantId, paymentId, amountCents, reason: reason.trim(), requestId })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitiveCorrectionRejection(result.error)) {
            setPendingRetry(null)
            requestIds.current.delete(fingerprint)
          } else {
            setPendingRetry(fingerprint)
          }
          return
        }
        setPendingRetry(null)
        onUpdated(result.data)
        setRefundId(null)
        setReason('')
        requestIds.current.delete(fingerprint)
      } catch {
        setPendingRetry(fingerprint)
        setError('Não foi possível confirmar o estorno. Tente novamente sem alterar os dados.')
      }
    })
  }

  function submitCancel(orderItemId: string) {
    if (!reason.trim()) return
    const fingerprint = JSON.stringify({ orderItemId, reason: reason.trim() })
    if (pendingRetry && pendingRetry !== fingerprint) return
    const requestId = requestIds.current.get(fingerprint) ?? crypto.randomUUID()
    requestIds.current.set(fingerprint, requestId)
    startTransition(async () => {
      try {
        const result = await cancelAccountOrderItemAction({ restaurantId, orderItemId, reason: reason.trim(), requestId })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitiveCorrectionRejection(result.error)) {
            setPendingRetry(null)
            requestIds.current.delete(fingerprint)
          } else {
            setPendingRetry(fingerprint)
          }
          return
        }
        setPendingRetry(null)
        onUpdated(result.data)
        setCancelId(null)
        setReason('')
        requestIds.current.delete(fingerprint)
      } catch {
        setPendingRetry(fingerprint)
        setError('Não foi possível confirmar o cancelamento. Tente novamente com o mesmo motivo.')
      }
    })
  }

  return <section className="tv-cash-corrections">
    <div className="tv-cash-subheading"><strong>Correções e estornos</strong><small>Os lançamentos originais são mantidos no histórico.</small></div>
    {account.payments.filter((payment) => payment.entryType === 'received').map((payment) => {
      const available = refundable(payment.id, payment.amountAppliedCents)
      if (!available && refundId !== payment.id) return null
      return <div className="tv-cash-correction-row" key={payment.id}>
        <div className="tv-cash-correction-summary"><span><strong>{payment.methodName}</strong><small>Recebido {formatCents(payment.amountAppliedCents)} · disponível para estorno {formatCents(available)}</small></span>
          {refundId === payment.id ? <div className="tv-cash-correction-form">
            <label>Valor a estornar<input inputMode="numeric" value={amountText} disabled={pendingRetry !== null} onChange={(event) => setAmountText(event.target.value)} onBlur={() => { const value = digitsToCents(amountText); if (value !== null) setAmountText(formatCentsInput(value)) }} /></label>
            <label>Motivo<textarea value={reason} disabled={pendingRetry !== null} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do estorno" /></label>
            <div><button type="button" disabled={busy || !digitsToCents(amountText) || (pendingRetry === null && digitsToCents(amountText)! > available) || reason.trim().length < 3 || (pendingRetry !== null && pendingRetry !== JSON.stringify({ paymentId: payment.id, amountCents: digitsToCents(amountText), reason: reason.trim() }))} onClick={() => submitRefund(payment.id)}>{busy ? <SpinnerRing decorative /> : null}{pendingRetry ? 'Repetir estorno' : 'Registrar estorno'}</button><button type="button" className="tv-cash-correction-cancel" disabled={busy || pendingRetry !== null} onClick={() => setRefundId(null)}>Cancelar</button></div>
          </div> : <button type="button" disabled={busy || pendingRetry !== null} onClick={() => openRefund(payment.id, available)}>Estornar</button>}
        </div>
      </div>
    })}
    {role === 'admin' && account.status === 'open' ? account.orders.flatMap((order) => order.items.filter((item) => !item.cancelledAt || cancelId === item.id).map((item) => <div className="tv-cash-correction-row" key={item.id}>
      <div className="tv-cash-correction-summary"><span><strong>{item.quantity}× {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</strong><small>{formatCents(item.lineTotalCents)} · pedido {order.id.slice(0, 8)}</small></span>
        {cancelId === item.id ? <div className="tv-cash-correction-form">
          <label>Motivo do cancelamento<textarea value={reason} disabled={pendingRetry !== null} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo do cancelamento" /></label>
          <div><button type="button" disabled={busy || reason.trim().length < 3 || (pendingRetry !== null && pendingRetry !== JSON.stringify({ orderItemId: item.id, reason: reason.trim() }))} onClick={() => submitCancel(item.id)}>{busy ? <SpinnerRing decorative /> : null}{pendingRetry ? 'Repetir cancelamento' : 'Confirmar cancelamento'}</button><button type="button" className="tv-cash-correction-cancel" disabled={busy || pendingRetry !== null} onClick={() => setCancelId(null)}>Voltar</button></div>
        </div> : <button type="button" disabled={busy || pendingRetry !== null} onClick={() => { setCancelId(item.id); setRefundId(null); setReason(''); setError(null) }}>Cancelar item</button>}
      </div>
    </div>)) : null}
    {pendingRetry ? <p className="tv-cash-inline-hint" role="status">A resposta anterior ficou incerta. Repita a mesma correção antes de iniciar outra.</p> : null}
    {error ? <p className="tv-cash-inline-error" role="alert">{error}</p> : null}
  </section>
}

function isDefinitiveCorrectionRejection(message: string): boolean {
  return [
    'Apenas o caixa e a administração',
    'Somente a administração',
    'Você não tem permissão para esta operação',
    'A comanda não foi encontrada',
    'O estorno excede o valor líquido do recebimento original',
    'Estorne valores suficientes antes de cancelar este item',
    'Este item já foi cancelado',
    'O recebimento não está disponível neste restaurante',
    'O item não está disponível neste restaurante',
    'O pedido não está disponível neste restaurante',
  ].some((knownMessage) => message.includes(knownMessage))
}
