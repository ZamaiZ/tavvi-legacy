'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { LuBanknote, LuCircleAlert } from 'react-icons/lu'
import type { PaymentMethodDTO, TableAccountDTO } from '@/domain/table-account'
import { digitsToCents, formatCents, formatCentsInput } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { Combobox } from '@/components/ui/combobox'
import { recordAccountPaymentAction } from '@/server/actions/table-accounts'

export function PaymentEntry({
  restaurantId,
  account,
  methods,
  onUpdated,
  onOperationStateChange,
}: {
  restaurantId: string
  account: TableAccountDTO
  methods: PaymentMethodDTO[]
  onUpdated: (account: TableAccountDTO) => void
  onOperationStateChange: (state: 'idle' | 'busy' | 'uncertain') => void
}) {
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '')
  const [amountText, setAmountText] = useState(formatCentsInput(account.balanceDueCents))
  const [cashText, setCashText] = useState(formatCentsInput(account.balanceDueCents))
  const [error, setError] = useState<string | null>(null)
  const [retryRequired, setRetryRequired] = useState(false)
  const [busy, startTransition] = useTransition()
  const requestIds = useRef(new Map<string, string>())
  const methodSnapshots = useRef(new Map<string, PaymentMethodDTO>())
  const previousBalance = useRef(account.balanceDueCents)
  const method = methods.find((entry) => entry.id === methodId)
    ?? (retryRequired ? methodSnapshots.current.get(methodId) : undefined)
    ?? null
  const appliedCents = digitsToCents(amountText)
  const receivedCents = method?.methodType === 'cash' ? digitsToCents(cashText) : null
  const changeCents = receivedCents !== null && appliedCents !== null ? Math.max(receivedCents - appliedCents, 0) : 0
  const canSubmit = !!method && appliedCents !== null && appliedCents > 0
    && appliedCents <= 2_147_483_647
    && (retryRequired || appliedCents <= account.balanceDueCents)
    && (method.methodType !== 'cash' || (receivedCents !== null && receivedCents >= appliedCents && receivedCents <= 2_147_483_647))

  const defaultDisplay = useMemo(() => formatCents(account.balanceDueCents), [account.balanceDueCents])

  useEffect(() => {
    const before = previousBalance.current
    previousBalance.current = account.balanceDueCents
    if (before === account.balanceDueCents || retryRequired || busy) return
    setAmountText((current) => digitsToCents(current) === before ? formatCentsInput(account.balanceDueCents) : current)
    setCashText((current) => digitsToCents(current) === before ? formatCentsInput(account.balanceDueCents) : current)
  }, [account.balanceDueCents, busy, retryRequired])

  useEffect(() => {
    for (const entry of methods) methodSnapshots.current.set(entry.id, entry)
  }, [methods])

  useEffect(() => {
    if (!retryRequired && !methods.some((entry) => entry.id === methodId)) setMethodId(methods[0]?.id ?? '')
  }, [methodId, methods, retryRequired])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || !method || appliedCents === null || busy) return
    const payload = { methodId: method.id, amountAppliedCents: appliedCents, cashReceivedCents: receivedCents }
    const fingerprint = JSON.stringify({ accountId: account.accountId, ...payload })
    const requestId = requestIds.current.get(fingerprint) ?? crypto.randomUUID()
    requestIds.current.set(fingerprint, requestId)
    setError(null)
    onOperationStateChange('busy')
    startTransition(async () => {
      try {
        const result = await recordAccountPaymentAction({
          restaurantId,
          accountId: account.accountId,
          requestId,
          methodId: method.id,
          amountAppliedCents: appliedCents,
          cashReceivedCents: receivedCents,
        })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitivePaymentRejection(result.error)) {
            setRetryRequired(false)
            requestIds.current.delete(fingerprint)
            onOperationStateChange('idle')
          } else {
            setRetryRequired(true)
            onOperationStateChange('uncertain')
          }
          return
        }
        setRetryRequired(false)
        onOperationStateChange('idle')
        onUpdated(result.data)
        requestIds.current.delete(fingerprint)
        setAmountText(formatCentsInput(result.data.balanceDueCents))
        setCashText(formatCentsInput(result.data.balanceDueCents))
      } catch {
        setRetryRequired(true)
        onOperationStateChange('uncertain')
        setError('Não foi possível confirmar o recebimento. Você pode tentar novamente sem duplicar o lançamento.')
      }
    })
  }

  if (!methods.length && !retryRequired) return <div className="tv-cash-payment-empty"><LuCircleAlert aria-hidden="true" />Nenhuma forma de pagamento está ativa para este restaurante.</div>

  return <form className="tv-cash-payment-entry" onSubmit={submit}>
    <div className="tv-cash-payment-heading"><span><LuBanknote aria-hidden="true" /></span><div><strong>Registrar pagamento recebido</strong><small>Saldo atual: {defaultDisplay}</small></div></div>
    <p className="tv-cash-payment-explainer">Registre cada parte separadamente para combinar formas de pagamento. Um recebimento parcial atualiza o saldo e mantém a comanda aberta.</p>
    <div className="tv-cash-payment-fields">
      <div className="tv-cash-payment-field"><span>Forma de pagamento</span>{retryRequired && method && !methods.some((entry) => entry.id === method.id) ? <strong className="tv-cash-payment-method-readonly">{method.name} · indisponível para novos recebimentos</strong> : <Combobox label="Forma de pagamento" value={methodId || null} options={methods.map((entry) => ({ value: entry.id, label: entry.name }))} disabled={retryRequired || busy} onValueChange={setMethodId} />}</div>
      <label><span>Valor aplicado à conta</span><span className="tv-cash-money-field"><b>R$</b><input inputMode="numeric" value={amountText} disabled={retryRequired || busy} onChange={(event) => setAmountText(event.target.value)} onBlur={() => { const cents = digitsToCents(amountText); if (cents !== null) setAmountText(formatCentsInput(cents)) }} /></span></label>
      {method?.methodType === 'cash' ? <label><span>Valor recebido em dinheiro</span><span className="tv-cash-money-field"><b>R$</b><input inputMode="numeric" value={cashText} disabled={retryRequired || busy} onChange={(event) => setCashText(event.target.value)} onBlur={() => { const cents = digitsToCents(cashText); if (cents !== null) setCashText(formatCentsInput(cents)) }} /></span></label> : null}
    </div>
    {method?.methodType === 'cash' ? <div className="tv-cash-change"><span>Troco</span><strong>{formatCents(changeCents)}</strong></div> : null}
    {error ? <p className="tv-cash-inline-error" role="alert">{error}{error.includes('página Financeiro') ? <> <Link href={`/restaurantes/${restaurantId}/financeiro`}>Abrir Financeiro</Link></> : null}</p> : null}
    {retryRequired ? <p className="tv-cash-inline-hint" role="status">A resposta anterior ficou incerta. Repita o mesmo lançamento antes de alterá-lo.</p> : null}
    <button type="submit" className="tv-cash-register-payment" disabled={!canSubmit || busy}>{busy ? <><SpinnerRing decorative /> Registrando…</> : `${retryRequired ? 'Repetir confirmação' : 'Registrar'} ${formatCents(appliedCents ?? 0)} em ${method?.name ?? 'pagamento'}`}</button>
    <small className="tv-cash-payment-footnote">O recebimento é registrado no sistema. O pagamento é processado separadamente na maquininha ou no meio escolhido.</small>
  </form>
}

function isDefinitivePaymentRejection(message: string): boolean {
  return [
    'Você não tem acesso às comandas deste restaurante',
    'Você não tem acesso a este restaurante',
    'A comanda não está disponível neste restaurante',
    'A comanda não foi encontrada',
    'A comanda já foi encerrada',
    'Esta comanda não aceita essa alteração',
    'Não há saldo pendente para receber',
    'O valor excede o saldo atual',
    'Essa forma de pagamento está inativa',
    'Abra o caixa na página Financeiro',
    'Confira o valor recebido em dinheiro e o troco',
    'Você não tem permissão para esta operação',
  ].some((knownMessage) => message.includes(knownMessage))
}
