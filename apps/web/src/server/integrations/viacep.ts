import 'server-only'
import { ufSchema, type UF } from '@/domain/restaurant'
import { UserFacingError } from '@/server/dal/auth'

export type CepLookup = { cep: string; street: string; district: string; city: string; state: UF }

// Indisponibilidade do ViaCEP, e não erro do CEP: o formulário libera
// cidade e UF para a pessoa preencher à mão em vez de travar o cadastro.
export class CepUnavailableError extends UserFacingError {}

const UNREADABLE = 'O ViaCEP respondeu algo que não dá para ler. Tente de novo ou preencha à mão.'

function masked(cep: string) {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function lookupCep(cep: string): Promise<CepLookup> {
  let response: Response
  try {
    response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('[viacep] sem resposta', error)
    throw new CepUnavailableError('O ViaCEP não respondeu. Tente de novo ou preencha o endereço à mão.')
  }

  if (response.status === 400) {
    throw new UserFacingError(`CEP ${masked(cep)} inválido para os Correios.`)
  }
  if (!response.ok) {
    console.error('[viacep] status', response.status)
    throw new CepUnavailableError(
      `O ViaCEP respondeu com erro (HTTP ${response.status}). Tente de novo ou preencha à mão.`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    console.error('[viacep] corpo ilegível', error)
    throw new CepUnavailableError(UNREADABLE)
  }

  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  // O ViaCEP responde 200 com { "erro": true } (ou "true", em versões
  // antigas) para CEP com formato válido que não existe.
  if (data.erro === true || data.erro === 'true') {
    throw new UserFacingError(`CEP ${masked(cep)} não encontrado nos Correios.`)
  }

  const state = ufSchema.safeParse(data.uf)
  const city = text(data.localidade)
  if (!state.success || !city) {
    console.error('[viacep] resposta inesperada', data)
    throw new CepUnavailableError(UNREADABLE)
  }

  // CEP único de cidade pequena chega sem rua e sem bairro: devolve vazio,
  // e o formulário pede que a pessoa complete.
  return { cep, street: text(data.logradouro), district: text(data.bairro), city, state: state.data }
}
