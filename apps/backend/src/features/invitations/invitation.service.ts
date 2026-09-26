import { createHash, randomBytes } from 'node:crypto'
import type { CreateInvitationInput, CreatedInvitation, PlatformInvitation, RevokedInvitation } from '@tavvi/api-contracts'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { enforceAdminMutationRateLimit } from '../../http/security.js'
import type { AdminContext } from '../../http/request-context.js'
import { createInviteSchema, inviteIdSchema } from './invitation.schemas.js'

type InviteAdminRow = {
  id: string
  email: string | null
  expires_at: string
  redeemed_at: string | null
  revoked_at: string | null
  created_at: string
  created_by_email: string
  redeemed_by_email: string | null
}

function mapInvite(row: InviteAdminRow): PlatformInvitation {
  return {
    id: row.id,
    email: row.email,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
    redeemedByEmail: row.redeemed_by_email,
  }
}

function tokenHashForDb(token: string) {
  return `\\x${createHash('sha256').update(token).digest('hex')}`
}

function generateInviteToken() {
  return randomBytes(32).toString('base64url')
}

function inviteLink(token: string) {
  return `${getServerEnv().panelPublicUrl}/convite/${token}`
}

export async function listInvitations(context: AdminContext): Promise<PlatformInvitation[]> {
  const result = await context.supabase.rpc('list_platform_admin_invites')
  if (result.error) throw new HttpError(500, 'INVITES_READ_FAILED', 'Não foi possível carregar os convites.')
  return result.data.map(mapInvite)
}

export async function getInvitation(context: AdminContext, rawId: string): Promise<PlatformInvitation> {
  const id = inviteIdSchema.parse(rawId)
  const result = await context.supabase.rpc('get_platform_admin_invite', { p_invite_id: id })
  if (result.error) throw new HttpError(500, 'INVITE_READ_FAILED', 'Não foi possível consultar o convite.')
  const row = result.data[0]
  if (!row) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
  return mapInvite(row)
}

export async function createInvitation(context: AdminContext, rawInput: unknown): Promise<CreatedInvitation> {
  const input: CreateInvitationInput = createInviteSchema.parse(rawInput)
  await enforceAdminMutationRateLimit(context)

  const token = generateInviteToken()
  const result = await context.supabase.rpc('create_platform_admin_invite', {
    p_email: input.email || null,
    p_expires_in_days: input.expiresInDays,
    p_token_hash: tokenHashForDb(token),
    p_trusted_ip: context.trustedIp,
  })
  if (result.error) throw new HttpError(500, 'INVITE_CREATE_FAILED', 'Não foi possível criar o convite.')
  const row = result.data[0]
  if (!row) throw new HttpError(500, 'INVITE_CREATE_FAILED', 'Não foi possível criar o convite.')
  return { id: row.id, link: inviteLink(token) }
}

export async function rotateInvitation(context: AdminContext, rawId: string): Promise<CreatedInvitation> {
  const id = inviteIdSchema.parse(rawId)
  await enforceAdminMutationRateLimit(context)

  const token = generateInviteToken()
  const result = await context.supabase.rpc('rotate_platform_admin_invite', {
    p_invite_id: id,
    p_token_hash: tokenHashForDb(token),
  })
  if (result.error) {
    if (result.error.code === 'P0002') throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
    if (result.error.code === 'P0001') throw new HttpError(409, 'INVITE_NOT_PENDING', 'Somente convites pendentes podem gerar um novo link.')
    throw new HttpError(500, 'INVITE_ROTATE_FAILED', 'Não foi possível gerar um novo link.')
  }
  const row = result.data[0]
  if (!row) throw new HttpError(500, 'INVITE_ROTATE_FAILED', 'Não foi possível gerar um novo link.')
  return { id: row.id, link: inviteLink(token) }
}

export async function revokeInvitation(context: AdminContext, rawId: string): Promise<RevokedInvitation> {
  const id = inviteIdSchema.parse(rawId)
  await enforceAdminMutationRateLimit(context)

  const result = await context.supabase.rpc('revoke_platform_admin_invite', {
    p_invite_id: id,
    p_trusted_ip: context.trustedIp,
  })
  if (result.error) {
    if (result.error.code === 'P0002') throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
    if (result.error.code === 'P0001') throw new HttpError(409, 'INVITE_NOT_PENDING', 'Somente convites pendentes podem ser revogados.')
    throw new HttpError(500, 'INVITE_REVOKE_FAILED', 'Não foi possível revogar o convite.')
  }
  const row = result.data[0]
  if (!row) throw new HttpError(500, 'INVITE_REVOKE_FAILED', 'Não foi possível revogar o convite.')
  return { id: row.id, revokedAt: row.revoked_at }
}
