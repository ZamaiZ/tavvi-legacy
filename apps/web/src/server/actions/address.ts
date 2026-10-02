'use server'

import { z } from 'zod'
import { requireUser } from '@/server/dal/auth'
import { CepUnavailableError, lookupCep, type CepLookup } from '@/server/integrations/viacep'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { runAction, type ActionResult } from './result'

const cepInputSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 8, { error: 'CEP inválido: informe os 8 dígitos.' })

export type CepLookupOutcome =
  | { kind: 'found'; address: CepLookup }
  | { kind: 'unavailable'; message: string }

// Consulta, não mutação. Passa por action porque o formulário é componente
// de cliente, e porque o servidor dá tempo limite, limite de chamadas e a
// mensagem exata de cada falha.
export async function lookupCepAction(cep: unknown): Promise<ActionResult<CepLookupOutcome>> {
  return runAction(async () => {
    const digits = cepInputSchema.parse(cep)
    const user = await requireUser()
    await enforceRateLimit('cep:lookup', user.id)
    try {
      return { kind: 'found', address: await lookupCep(digits) }
    } catch (error) {
      if (error instanceof CepUnavailableError) return { kind: 'unavailable', message: error.message }
      throw error
    }
  })
}
