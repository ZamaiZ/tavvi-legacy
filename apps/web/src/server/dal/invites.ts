import 'server-only'
import { headers } from 'next/headers'
import { uuidSchema } from '@/domain/common'
import {
  createPlatformInviteSchema,
  createTeamInviteSchema,
  inviteTokenSchema,
  type CreatedInviteDTO,
  type InviteDTO,
  type InviteKind,
  type InvitePreviewDTO,
  type MemberRole,
  type PlatformInviteDTO,
} from '@/domain/invite'
import { createFromInviteSchema } from '@/domain/restaurant'
import type { RevalidationTarget } from '@/server/revalidate'
import { originFor } from '@/server/territory'
import { recordAudit } from '@/server/security/audit'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import {
  generateInviteToken,
  hashInviteTokenForDb,
} from '@/server/security/tokens'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import {
  ConflictError,
  currentTerritory,
  requireRestaurantAdmin,
  requirePlatformAdmin,
  UserFacingError,
} from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

type InviteRow = {
  id: string
  restaurant_id: string | null
  role: MemberRole
  email: string | null
  expires_at: string
  redeemed_at: string | null
  revoked_at: string | null
}

// token_hash NUNCA entra aqui. Nem para o dono do restaurante: não há uso
// legítimo para ele fora das funções do banco.
const INVITE_COLUMNS =
  'id, restaurant_id, role, email, expires_at, redeemed_at, revoked_at'

function toInviteDTO(row: InviteRow): InviteDTO {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    role: row.role,
    email: row.email,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at,
  }
}

// O corpo comum aos dois tipos de convite. O que muda entre eles é QUEM
// autoriza e o que vai na linha; gerar o token, guardar só o hash e montar o
// link é idêntico — e é a parte sensível, que não se duplica.
async function insertInvite(input: {
  restaurantId: string | null
  role: MemberRole
  email: string | null
  expiresInDays: number
  createdBy: string
}): Promise<CreatedInviteDTO> {
  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000)

  const supabase = await db()
  const { data: row, error } = await supabase
    .from('invites')
    .insert({
      restaurant_id: input.restaurantId,
      role: input.role,
      // Só o hash vai para o banco. O token em claro existe apenas nesta
      // função e no link devolvido uma única vez.
      token_hash: hashInviteTokenForDb(token),
      email: input.email,
      created_by: input.createdBy,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Não foi possível criar o convite: ${error.message}`)
  }

  await recordAudit({
    action: 'invite.created',
    subjectType: 'invite',
    subjectId: row.id as string,
    restaurantId: input.restaurantId ?? undefined,
    metadata: {
      kind: input.restaurantId === null ? 'platform' : 'team',
      role: input.role,
      boundToEmail: Boolean(input.email),
    },
  })

  const requestHeaders = await headers()
  const protocol =
    requestHeaders.get('x-forwarded-proto') === 'https' ? 'https:' : 'http:'

  // O convite leva para o território onde a pessoa vai trabalhar.
  return {
    id: row.id as string,
    link: `${originFor('painel', protocol)}/convite/${token}`,
  }
}

export async function createPlatformInvite(
  input: unknown,
): Promise<CreatedInviteDTO> {
  const data = createPlatformInviteSchema.parse(input)
  const user = await requirePlatformAdmin()
  await enforceRateLimit('mutation', await rateLimitIdentity())

  return insertInvite({
    restaurantId: null,
    role: 'admin',
    email: data.email ?? null,
    expiresInDays: data.expiresInDays,
    createdBy: user.id,
  })
}

// `alvo` aninhado, e não interseção: `CreatedInviteDTO` já tem `id`, que é o
// do convite, e uma interseção com `RevalidationTarget` faria ele disputar a
// chave com o id do restaurante.
export async function createTeamInvite(
  input: unknown,
): Promise<CreatedInviteDTO & { revalidationTarget: RevalidationTarget }> {
  const data = createTeamInviteSchema.parse(input)
  // Autorização por POSSE do recurso, não só por estar autenticado. É o que
  // fecha IDOR: saber o id de outro restaurante não basta.
  const user = await requireRestaurantAdmin(data.restaurantId)

  const invite = await insertInvite({
    restaurantId: data.restaurantId,
    role: data.role,
    email: data.email ?? null,
    expiresInDays: data.expiresInDays,
    createdBy: user.id,
  })

  return { ...invite, revalidationTarget: await getRestaurantRevalidationTarget(data.restaurantId) }
}

type PlatformInviteRow = {
  id: string
  email: string | null
  expires_at: string
  redeemed_at: string | null
  revoked_at: string | null
  created_at: string
  created_by_email: string
  redeemed_by_email: string | null
}

function toPlatformInviteDTO(row: PlatformInviteRow): PlatformInviteDTO {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at,
    createdByEmail: row.created_by_email,
    redeemedByEmail: row.redeemed_by_email,
  }
}

export async function listPlatformInvites(): Promise<PlatformInviteDTO[]> {
  await requirePlatformAdmin()

  const supabase = await db()
  const { data, error } = await supabase.rpc('list_platform_admin_invites')

  if (error) {
    throw new Error(`Não foi possível listar convites: ${error.message}`)
  }
  return ((data ?? []) as PlatformInviteRow[])
    .map(toPlatformInviteDTO)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function getPlatformInvite(
  inviteId: unknown,
): Promise<PlatformInviteDTO | null> {
  const id = uuidSchema.parse(inviteId)
  await requirePlatformAdmin()

  const supabase = await db()
  const { data, error } = await supabase.rpc('get_platform_admin_invite', {
    p_invite_id: id,
  })
  if (error) throw new Error('Não foi possível carregar o convite.', { cause: error })
  const row = (data?.[0] ?? null) as PlatformInviteRow | null
  return row ? toPlatformInviteDTO(row) : null
}

export async function rotatePlatformInvite(
  inviteId: unknown,
): Promise<CreatedInviteDTO> {
  const id = uuidSchema.parse(inviteId)
  await requirePlatformAdmin()
  await enforceRateLimit('mutation', await rateLimitIdentity())

  const token = generateInviteToken()
  const supabase = await db()
  const { data, error } = await supabase.rpc('rotate_platform_admin_invite', {
    p_invite_id: id,
    p_token_hash: hashInviteTokenForDb(token),
  })
  if (error?.code === 'P0002') {
    throw new UserFacingError('Convite não encontrado.')
  }
  if (error?.code === 'P0001') {
    throw new ConflictError('Somente convites pendentes podem gerar um novo link.')
  }
  if (error) throw new Error(`Não foi possível gerar novo link: ${error.message}`)
  const row = data?.[0]
  if (!row?.id) throw new UserFacingError('Convite não encontrado.')

  // The RPC records rotation atomically with revocation/insertion. A second
  // recordAudit call here would duplicate the audit event.
  const requestHeaders = await headers()
  const protocol =
    requestHeaders.get('x-forwarded-proto') === 'https' ? 'https:' : 'http:'
  return {
    id: row.id as string,
    link: `${originFor('painel', protocol)}/convite/${token}`,
  }
}

export async function listInvites(restaurantId: unknown): Promise<InviteDTO[]> {
  const id = uuidSchema.parse(restaurantId)
  await requireRestaurantAdmin(id)

  const supabase = await db()
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_COLUMNS)
    .eq('restaurant_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Não foi possível listar convites: ${error.message}`)
  }
  return ((data ?? []) as InviteRow[]).map(toInviteDTO)
}

// `null` quando o convite é de PLATAFORMA: não existe restaurante para
// revalidar, só as listas. É a única escrita do projeto que pode legitimamente
// não ter alvo.
export async function revokeInvite(
  inviteId: unknown,
): Promise<RevalidationTarget | null> {
  const id = uuidSchema.parse(inviteId)

  const supabase = await db()
  // Descobrimos o dono do convite ANTES de autorizar. Convite de plataforma
  // é da plataforma; convite de equipe é do administrador daquele
  // restaurante. Confiar num id vindo do cliente seria a brecha de IDOR.
  const { data: row, error: lookupError } = await supabase
    .from('invites')
    .select('restaurant_id')
    .eq('id', id)
    .single()

  if (lookupError || !row) throw new UserFacingError('Convite não encontrado.')

  if (row.restaurant_id === null) await requirePlatformAdmin()
  else await requireRestaurantAdmin(row.restaurant_id)

  const { error } = await supabase
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('redeemed_at', null)

  if (error) throw new Error(`Não foi possível revogar: ${error.message}`)

  await recordAudit({
    action: 'invite.revoked',
    subjectType: 'invite',
    subjectId: id,
    restaurantId: row.restaurant_id ?? undefined,
  })

  return row.restaurant_id ? getRestaurantRevalidationTarget(row.restaurant_id) : null
}

export async function previewInvite(
  token: unknown,
): Promise<InvitePreviewDTO | null> {
  // Rate limit ANTES de qualquer consulta. Sem isso, o endpoint vira um
  // oráculo para adivinhar tokens por força bruta.
  await enforceRateLimit('invite:preview', await rateLimitIdentity())

  const parsed = inviteTokenSchema.safeParse(token)
  if (!parsed.success) return null

  const supabase = await db()
  const { data, error } = await supabase.rpc('preview_invite', {
    p_token: parsed.data,
  })

  // Token desconhecido, vencido, revogado e já resgatado devolvem todos zero
  // linhas. As quatro situações são indistinguíveis daqui, que é o ponto.
  if (error || !data || data.length === 0) return null

  return {
    kind: data[0].invite_kind as InviteKind,
    restaurantName: data[0].restaurant_name as string | null,
    role: data[0].invite_role as MemberRole,
  }
}

// Devolve o ALVO, e não só o id. Quem resgatou acabou de entrar num
// restaurante, e a action precisa do slug para revalidar — e do id, que é o
// que ela já devolvia. Os dois vêm no mesmo objeto.
export async function redeemInvite(token: unknown): Promise<RevalidationTarget> {
  await enforceRateLimit('invite:redeem', await rateLimitIdentity())

  const parsed = inviteTokenSchema.safeParse(token)
  // Mensagem idêntica à de token válido porém expirado, revogado ou já usado.
  // Não revelamos qual condição falhou.
  if (!parsed.success) throw new UserFacingError('Convite inválido')

  const supabase = await db()
  const { data, error } = await supabase.rpc('redeem_invite', {
    p_token: parsed.data,
  })

  if (error || !data) throw new UserFacingError('Convite inválido')
  return getRestaurantRevalidationTarget(data as string)
}

export async function redeemPlatformInvite(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = createFromInviteSchema.parse(input)
  await enforceRateLimit('invite:redeem', await rateLimitIdentity())

  const supabase = await db()
  const { data: restaurantId, error } = await supabase.rpc(
    'redeem_platform_invite',
    { p_token: data.token, p_name: data.name, p_slug: data.slug },
  )

  if (error) {
    // A função levanta P0001 SÓ para colisão e formato de endereço, e só
    // DEPOIS de já ter confirmado o convite. Repassar esse texto é seguro —
    // quem chegou aqui já provou ter convite válido — e é o que permite a
    // pessoa corrigir sozinha. Qualquer outro código vira a mensagem opaca.
    if (error.code === 'P0001') throw new ConflictError(error.message)
    throw new UserFacingError('Convite inválido')
  }
  if (!restaurantId) throw new UserFacingError('Convite inválido')

  return getRestaurantRevalidationTarget(restaurantId as string)
}
