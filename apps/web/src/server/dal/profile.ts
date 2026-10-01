import 'server-only'
import { cache } from 'react'
import { updateDisplayNameSchema } from '@/domain/profile'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, getCurrentUser, requireUser } from './auth'

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

// A RLS (profiles_update_self) já restringe a escrita ao próprio perfil; o
// filtro por id aqui é o mesmo limite dito duas vezes, não a única barreira.
export async function updateMyDisplayName(input: unknown): Promise<string> {
  const { displayName } = updateDisplayNameSchema.parse(input)
  const user = await requireUser()
  await enforceRateLimit('mutation', await rateLimitIdentity())

  const supabase = await db()
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)
    .select('display_name')
    .single()

  if (error) throw new Error(`Não foi possível salvar o nome: ${error.message}`)
  return data.display_name
}
