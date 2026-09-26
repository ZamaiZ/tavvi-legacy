import 'server-only'
import { createUserClient } from '@/server/dal/_client'
import { currentTerritory, UserFacingError } from '@/server/dal/auth'

export const RATE_LIMITS = {
  'invite:preview': { max: 10, windowSeconds: 60 },
  'invite:redeem': { max: 5, windowSeconds: 60 },
  'auth:login': { max: 10, windowSeconds: 60 },
  'tag:resolve': { max: 60, windowSeconds: 60 },
  mutation: { max: 60, windowSeconds: 60 },
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
