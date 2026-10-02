import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { MEMBER_ROLE_LABELS } from '@/domain/invite'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, getCurrentUser, getPlatformAdminStatus, requireUser, UserFacingError } from './auth'
import { listMyRestaurants } from './restaurant-read'

async function db() {
  return createUserClient(await currentTerritory())
}

// O nome da própria conta, para as telas de conta. É só exibição: se a
// leitura falhar, a casca abre sem o nome em vez de quebrar a página.
export const getMyDisplayName = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await db()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[profile] Could not load the display name', error)
    return null
  }
  return data?.display_name ?? null
})

export type AccountProfile = {
  displayName: string | null
  email: string | null
  createdAt: string | null
  lastSignInAt: string | null
  passwordUpdatedAt: string | null
  platformAdmin: boolean
  restaurants: { name: string; role: string }[]
}

export const getAccountProfile = cache(async (): Promise<AccountProfile> => {
  const user = await requireUser()
  const [displayName, territory] = await Promise.all([
    getMyDisplayName(),
    currentTerritory(),
  ])

  const platformAdmin = territory === 'admin' && (await getPlatformAdminStatus()) === 'allowed'
  const restaurants = platformAdmin ? [] : (await listMyRestaurants()).map((restaurant) => ({
    name: restaurant.name,
    role: restaurant.role ? MEMBER_ROLE_LABELS[restaurant.role] : '—',
  }))

  return {
    displayName,
    email: user.email,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    passwordUpdatedAt: user.updatedAt,
    platformAdmin,
    restaurants,
  }
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { error: 'Informe sua senha atual.' }),
  password: z.string().min(8, { error: 'A nova senha precisa de ao menos 8 caracteres.' }).max(200, { error: 'Senha longa demais.' }),
  confirmation: z.string().min(1, { error: 'Confirme a nova senha.' }),
}).refine((value) => value.password === value.confirmation, {
  path: ['confirmation'],
  error: 'As senhas não coincidem.',
})

export async function changeMyPassword(input: unknown): Promise<void> {
  const data = changePasswordSchema.parse(input)
  const user = await requireUser()
  if (!user.email) throw new UserFacingError('Não foi possível verificar sua conta.')
  await enforceRateLimit('mutation', await rateLimitIdentity())

  const supabase = await db()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: data.currentPassword })
  if (signInError) throw new UserFacingError(signInError.code === 'invalid_credentials' ? 'A senha atual está incorreta.' : 'Não foi possível verificar sua senha atual.')
  const { error: updateError } = await supabase.auth.updateUser({ password: data.password })
  if (updateError) throw new UserFacingError('Não foi possível alterar a senha agora.')
}
