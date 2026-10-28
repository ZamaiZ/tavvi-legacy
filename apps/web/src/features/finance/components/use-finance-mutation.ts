'use client'

import { useState, useTransition } from 'react'
import type { FinanceDashboardDTO } from '@/domain/finance'
import type { ActionResult } from '@/server/actions/result'

type FinanceAction = (input: unknown) => Promise<ActionResult<FinanceDashboardDTO>>

export function useFinanceMutation(onUpdated: (data: FinanceDashboardDTO) => void, options?: { onSuccess?: () => void }) {
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ key: string; requestId: string } | null>(null)

  function submit(action: FinanceAction, input: Record<string, unknown>) {
    const key = JSON.stringify(input)
    if (pending && pending.key !== key) return
    const requestId = pending?.requestId ?? crypto.randomUUID()
    setPending({ key, requestId })
    setError(null)
    startTransition(async () => {
      try {
        const result = await action({ ...input, requestId })
        if (!result.ok) {
          setError(result.error)
          if (isDefinitiveFinanceRejection(result.error)) setPending(null)
          return
        }
        setPending(null)
        onUpdated(result.data)
        options?.onSuccess?.()
      } catch {
        setError('A resposta do caixa ficou incerta. Repita a mesma operação para confirmar sem duplicar o lançamento.')
      }
    })
  }

  function clearError() {
    setError(null)
  }

  return { busy, error, locked: pending !== null, submit, clearError }
}

function isDefinitiveFinanceRejection(message: string): boolean {
  return [
    'Você não tem permissão',
    'Já existe um caixa aberto',
    'Abra um caixa antes',
    'Este período não pertence',
    'Este caixa já foi fechado',
    'O dinheiro disponível',
    'Informe o motivo',
    'Há comandas abertas',
    'Confira o valor',
    'O saldo esperado ficou fora',
    'A solicitação já foi usada',
    'O período de caixa não foi encontrado',
    'Não são permitidos',
    'Mínimo de',
    'Máximo de',
    'Dados inválidos',
    'Confira',
  ].some((knownMessage) => message.includes(knownMessage))
}
