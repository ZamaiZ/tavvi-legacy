import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { memberRoleSchema, type MemberRole } from '@/domain/invite'
import { territoryFromHost, type Territory } from '@/server/territory'
import { createUserClient } from './_client'

export type AuthUser = {
  id: string
  email: string | null
  createdAt: string | null
  lastSignInAt: string | null
  updatedAt: string | null
}

// Erro PREVISTO, com mensagem escrita por nós, segura para chegar na tela.
// Diferente do genérico do runAction, que existe para não vazar nome de
// tabela e constraint do Postgres — um mapa do schema de graça para quem
// estiver sondando.
//
// Todo erro que deva ser mostrado ao usuário estende esta classe. O
// runAction testa a BASE, não cada filha, então acrescentar um erro novo
// não exige lembrar de atualizar o runAction junto.
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class ForbiddenError extends UserFacingError {
  constructor(message = 'Sem permissão para esta operação') {
    super(message)
  }
}

export class ConflictError extends UserFacingError {}

export const currentTerritory = cache(async (): Promise<Territory> => {
  const requestHeaders = await headers()
  return territoryFromHost(requestHeaders.get('host'))
})

// cache() do React deduplica dentro do MESMO render. Nao e cache entre
// requisicoes: continua tudo fresco, so evita a mesma consulta rodar cinco
// vezes numa pagina que chama getCurrentUser em varios componentes.
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const territory = await currentTerritory()
  // O territorio publico nao tem sessao, por construcao.
  if (territory === 'site') return null

  const supabase = await createUserClient(territory)
  // getUser() revalida o token contra o servidor de auth. getSession() so
  // decodifica o cookie e NUNCA deve ser usado para autorizar no servidor.
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    createdAt: data.user.created_at ?? null,
    lastSignInAt: data.user.last_sign_in_at ?? null,
    updatedAt: data.user.updated_at ?? null,
  }
})

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    // Caminho externo compartilhado pelos territórios privados. A rota real
    // `/entrar` escolhe a tela pelo host; redirecionar para um caminho interno
    // faria o proxy prefixá-lo de novo.
    redirect('/entrar')
  }
  return user
}

type GuardFunction = 'is_platform_admin' | 'is_member' | 'is_restaurant_admin'

export type PlatformAdminStatus = 'allowed' | 'denied' | 'unverified'

async function callGuard(
  fn: GuardFunction,
  args: Record<string, unknown> = {},
): Promise<boolean> {
  const supabase = await createUserClient(await currentTerritory())
  // O cast existe porque as três funções compartilham a forma
  // (uuid opcional) -> boolean, mas o tipo gerado as trata separadamente.
  const { data, error } = await supabase.rpc(
    fn as 'is_platform_admin',
    args as never,
  )
  return !error && data === true
}

export const getPlatformAdminStatus = cache(
  async (): Promise<PlatformAdminStatus> => {
    if (!(await getCurrentUser())) return 'denied'
    const supabase = await createUserClient(await currentTerritory())
    const { data, error } = await supabase.rpc('is_platform_admin')
    if (error) return 'unverified'
    return data === true ? 'allowed' : 'denied'
  },
)

export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  if ((await getPlatformAdminStatus()) !== 'allowed') throw new ForbiddenError()
  return user
}

export async function requirePlatformAdminPage(): Promise<AuthUser> {
  const user = await requireUser()
  const status = await getPlatformAdminStatus()
  if (status === 'denied') {
    redirect('/entrar?motivo=sem-acesso')
  }
  if (status === 'unverified') throw new ForbiddenError()
  return user
}

export async function requireMember(restaurantId: string): Promise<AuthUser> {
  const user = await requireUser()
  const allowed =
    (await callGuard('is_member', { rid: restaurantId })) ||
    (await callGuard('is_platform_admin'))
  if (!allowed) throw new ForbiddenError()
  return user
}

// Substituiu o requireOwner. A diferença não é de nome: `is_member` significa
// "trabalha aqui" e passou a ser insuficiente para escrever, agora que garçom,
// caixa e atendente existem.
export async function requireRestaurantAdmin(
  restaurantId: string,
): Promise<AuthUser> {
  const user = await requireUser()
  const allowed =
    (await callGuard('is_restaurant_admin', { rid: restaurantId })) ||
    (await callGuard('is_platform_admin'))
  if (!allowed) throw new ForbiddenError()
  return user
}

// Alimenta a camada de INTERFACE, e só ela: é o papel que decide se o botão
// aparece. Esconder botão é cortesia, não segurança — quem chamar a action na
// mão continua barrado pelo requireRestaurantAdmin e pela RLS.
//
// Devolve nulo para quem não é membro, o que é diferente de um papel sem
// poder. A tela usa a diferença: não-membro nem enxerga o restaurante.
export async function myRole(restaurantId: string): Promise<MemberRole | null> {
  await requireUser()
  const supabase = await createUserClient(await currentTerritory())
  const { data, error } = await supabase.rpc('my_role', { rid: restaurantId })
  if (error) {
    throw new Error('Não foi possível verificar seu acesso ao restaurante.', {
      cause: error,
    })
  }
  if (!data) return null

  const parsed = memberRoleSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
