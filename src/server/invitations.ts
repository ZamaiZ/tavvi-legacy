import { z } from 'zod'
import type { CreatedInvite, MobileInvite, RevokedInvite } from '@/contracts/mobile-api'
import type { AdminContext } from './auth'
import { getServerEnv } from './env'
import { HttpError } from './http'
import { enforceRateLimit, recordAudit } from './security'

export const createInviteSchema = z.object({ email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(), expiresInDays: z.number().int().min(1).max(30) })
export function generateInviteToken() { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') }
export async function hashInviteTokenForDb(token: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''); return `\\x${hex}` }

type InviteAdminRow = { id: string; email: string | null; expires_at: string; redeemed_at: string | null; revoked_at: string | null; created_at: string; created_by_email: string; redeemed_by_email: string | null }
function mapInvite(row: InviteAdminRow): MobileInvite {
  return { id: row.id, email: row.email, expiresAt: row.expires_at, redeemedAt: row.redeemed_at, revokedAt: row.revoked_at, createdAt: row.created_at, createdByEmail: row.created_by_email, redeemedByEmail: row.redeemed_by_email }
}
export async function listInvitations(context: AdminContext): Promise<MobileInvite[]> {
  const result = await context.supabase.rpc('list_platform_admin_invites')
  if (result.error) throw new HttpError(500, 'INVITES_READ_FAILED', 'Não foi possível carregar os convites.')
  return result.data.map(mapInvite)
}
export async function getInvitation(context: AdminContext, rawId: string): Promise<MobileInvite> {
  const id = z.string().uuid().parse(rawId)
  const result = await context.supabase.rpc('get_platform_admin_invite', { p_invite_id: id })
  if (result.error) throw new HttpError(500, 'INVITE_READ_FAILED', 'Não foi possível consultar o convite.')
  const row = result.data[0]
  if (!row) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
  return mapInvite(row)
}
export async function createInvitation(context: AdminContext, raw: unknown): Promise<CreatedInvite> {
  const input = createInviteSchema.parse(raw)
  const painelPublicUrl = getServerEnv().painelPublicUrl
  await enforceRateLimit(context.supabase, 'mutation', `${context.user.id}:${context.trustedIp ?? 'no-ip'}`)
  const token = generateInviteToken()
  const tokenHash = await hashInviteTokenForDb(token)
  const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
  const result = await context.supabase.from('invites').insert({ created_by: context.user.id, email: input.email || null, expires_at: expiresAt, restaurant_id: null, role: 'admin', token_hash: tokenHash }).select('id').single()
  if (result.error) throw new HttpError(500, 'INVITE_CREATE_FAILED', 'Não foi possível criar o convite.')
  await recordAudit(context, { action: 'invite.created', subjectType: 'invite', subjectId: result.data.id, metadata: { expiresInDays: input.expiresInDays, restrictedEmail: Boolean(input.email) } })
  return { id: result.data.id, link: `${painelPublicUrl}/convite/${token}` }
}

export async function rotateInvitation(context: AdminContext, rawId: string): Promise<CreatedInvite> {
  const id = z.string().uuid().parse(rawId)
  const painelPublicUrl = getServerEnv().painelPublicUrl
  await enforceRateLimit(context.supabase, 'mutation', `${context.user.id}:${context.trustedIp ?? 'no-ip'}`)
  const token = generateInviteToken()
  const tokenHash = await hashInviteTokenForDb(token)
  const result = await context.supabase.rpc('rotate_platform_admin_invite', { p_invite_id: id, p_token_hash: tokenHash })
  if (result.error) {
    if (result.error.code === 'P0002') throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
    if (result.error.code === 'P0001') throw new HttpError(409, 'INVITE_NOT_PENDING', 'Somente convites pendentes podem gerar um novo link.')
    throw new HttpError(500, 'INVITE_ROTATE_FAILED', 'Não foi possível gerar um novo link.')
  }
  const row = result.data[0]
  if (!row) throw new HttpError(500, 'INVITE_ROTATE_FAILED', 'Não foi possível gerar um novo link.')
  return { id: row.id, link: `${painelPublicUrl}/convite/${token}` }
}

type InviteRecord = { id: string; restaurant_id: string | null; expires_at: string; redeemed_at: string | null; revoked_at: string | null }
function assertPending(record: InviteRecord) {
  if (record.restaurant_id !== null) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
  if (record.redeemed_at || Date.parse(record.expires_at) <= Date.now()) throw new HttpError(409, 'INVITE_NOT_PENDING', 'Somente convites pendentes podem ser revogados.')
}
export async function revokeInvitation(context: AdminContext, rawId: string): Promise<RevokedInvite> {
  const id = z.string().uuid().parse(rawId)
  await enforceRateLimit(context.supabase, 'mutation', `${context.user.id}:${context.trustedIp ?? 'no-ip'}`)
  const lookup = await context.supabase.from('invites').select('id,restaurant_id,expires_at,redeemed_at,revoked_at').eq('id', id).maybeSingle()
  if (lookup.error) throw new HttpError(500, 'INVITE_READ_FAILED', 'Não foi possível consultar o convite.')
  if (!lookup.data || lookup.data.restaurant_id !== null) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
  if (lookup.data.revoked_at) return { id, revokedAt: lookup.data.revoked_at }
  assertPending(lookup.data)
  const now = new Date().toISOString()
  const updated = await context.supabase.from('invites').update({ revoked_at: now }).eq('id', id).is('restaurant_id', null).is('redeemed_at', null).is('revoked_at', null).gt('expires_at', now).select('id,revoked_at')
  if (updated.error) throw new HttpError(500, 'INVITE_REVOKE_FAILED', 'Não foi possível revogar o convite.')
  const row = updated.data[0]
  if (row?.revoked_at) { await recordAudit(context, { action: 'invite.revoked', subjectType: 'invite', subjectId: id }); return { id, revokedAt: row.revoked_at } }
  const reread = await context.supabase.from('invites').select('id,restaurant_id,expires_at,redeemed_at,revoked_at').eq('id', id).maybeSingle()
  if (reread.error) throw new HttpError(500, 'INVITE_READ_FAILED', 'Não foi possível consultar o convite.')
  if (!reread.data || reread.data.restaurant_id !== null) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Convite não encontrado.')
  if (reread.data.revoked_at) return { id, revokedAt: reread.data.revoked_at }
  assertPending(reread.data)
  throw new HttpError(409, 'INVITE_NOT_PENDING', 'O convite mudou de estado. Atualize a lista.')
}
