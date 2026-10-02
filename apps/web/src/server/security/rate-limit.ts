import 'server-only'
import { createUserClient } from '@/server/dal/_client'
import { currentTerritory, UserFacingError } from '@/server/dal/auth'

export const RATE_LIMITS = {
  'invite:preview': { max: 10, windowSeconds: 60 },
  'invite:redeem': { max: 5, windowSeconds: 60 },
  'auth:login': { max: 10, windowSeconds: 60 },
  'tag:resolve': { max: 60, windowSeconds: 60 },
  mutation: { max: 60, windowSeconds: 60 },
  'push:subscribe': { max: 20, windowSeconds: 60 },
  'push:test': { max: 5, windowSeconds: 60 },
  // Busca de CEP: digitar errado e corrigir algumas vezes é normal; trinta
  // por minuto ainda barra quem tentasse usar o painel como proxy do ViaCEP.
  'cep:lookup': { max: 30, windowSeconds: 60 },
  // O navegador pede um token novo antes de cada hora de sessão e ao
  // reconectar; trinta por minuto só barram um laço quebrado.
  'realtime:token': { max: 30, windowSeconds: 60 },
  // Resolver o link do Maps segue até 4 redirecionamentos do Google. Vinte
  // por minuto cobrem corrigir o link algumas vezes, e barram usar o painel
  // como proxy.
  'maps:resolve': { max: 20, windowSeconds: 60 },
  // Feedback anônimo, por IP (e restaurante, no início). O teto por
  // restaurante no banco (0030) é a barreira que não depende do IP.
  'feedback:start': { max: 5, windowSeconds: 600 },
  'feedback:publish': { max: 10, windowSeconds: 600 },
} as const

export type RateLimitBucket = keyof typeof RATE_LIMITS

export class RateLimitedError extends UserFacingError {
  constructor() {
    super('Muitas tentativas. Aguarde um minuto e tente de novo.')
  }
}

export async function enforceRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<void> {
  const { max, windowSeconds } = RATE_LIMITS[bucket]
  const supabase = await createUserClient(await currentTerritory())

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_identifier: identifier,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  // Falha fechada: se o contador nao responder, negamos. Um rate limit que
  // libera quando quebra nao e rate limit. E como tudo aqui depende do
  // mesmo banco, se ele caiu a aplicacao ja esta fora do ar de qualquer
  // forma -- nao ha disponibilidade sendo sacrificada.
  if (error || data !== true) throw new RateLimitedError()
}
