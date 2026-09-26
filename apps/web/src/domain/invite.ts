import { z } from 'zod'
import { uuidSchema } from './common'

export const memberRoleSchema = z.enum(['admin', 'cashier', 'attendant', 'waiter'])
export type MemberRole = z.infer<typeof memberRoleSchema>

// Os valores vivem em inglês no banco, como todo o resto do schema
// (draft/active/suspended, image/video). O português mora aqui, na borda, e
// é o único lugar que precisa mudar se um rótulo for repensado.
export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Administrador',
  cashier: 'Caixa',
  attendant: 'Atendente',
  waiter: 'Garçom',
}

// O que cada papel pode, em uma linha, para a tela explicar sem inventar.
export const MEMBER_ROLE_HINTS: Record<MemberRole, string> = {
  admin: 'Edita o cardápio, a identidade e a equipe.',
  cashier: 'Consulta o cardápio e os preços.',
  attendant: 'Consulta o cardápio e os preços.',
  waiter: 'Consulta o cardápio e os preços.',
}

// O convite de plataforma não pergunta restaurante nem papel: não existe
// restaurante ainda, e o papel é sempre administrador. O CHECK
// `invites_platform_role` garante o mesmo de onde a aplicação não alcança.
export const createPlatformInviteSchema = z.object({
  email: z.email({ error: 'E-mail inválido' }).optional(),
  expiresInDays: z.int().min(1).max(30).default(7),
})

export const createTeamInviteSchema = z.object({
  restaurantId: uuidSchema,
  role: memberRoleSchema,
  email: z.email({ error: 'E-mail inválido' }).optional(),
  expiresInDays: z.int().min(1).max(30).default(7),
})

export type InviteKind = 'platform' | 'team'

// O token é uma credencial ao portador. Formato base64url, 43 caracteres
// para 32 bytes.
export const inviteTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, { error: 'Convite inválido' })

export type InviteDTO = {
  id: string
  /** Nulo em convite de plataforma: o restaurante nasce do resgate. */
  restaurantId: string | null
  role: MemberRole
  email: string | null
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
}

export type PlatformInviteDTO = {
  id: string
  email: string | null
  createdAt: string
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
  createdByEmail: string
  redeemedByEmail: string | null
}

export type InviteState = 'pending' | 'redeemed' | 'expired' | 'revoked'

export function inviteState(
  invite: PlatformInviteDTO,
  now = Date.now(),
): InviteState {
  if (invite.revokedAt) return 'revoked'
  if (invite.redeemedAt) return 'redeemed'
  if (Date.parse(invite.expiresAt) <= now) return 'expired'
  return 'pending'
}

export type InviteStatus = 'pendente' | 'resgatado' | 'revogado' | 'vencido'

// Derivada, e não gravada: uma coluna de situação precisaria de um job para
// virar 'vencido' na hora certa, e ficaria mentindo entre uma execução e a
// próxima.
export function inviteStatus(invite: InviteDTO, now = new Date()): InviteStatus {
  if (invite.redeemedAt) return 'resgatado'
  if (invite.revokedAt) return 'revogado'
  if (new Date(invite.expiresAt) <= now) return 'vencido'
  return 'pendente'
}

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  pendente: 'Pendente',
  resgatado: 'Resgatado',
  revogado: 'Revogado',
  vencido: 'Vencido',
}

// Devolvido UMA única vez, na criação. O banco guarda só o hash e não
// consegue reconstruir este link.
export type CreatedInviteDTO = {
  id: string
  link: string
}

export type InvitePreviewDTO = {
  kind: InviteKind
  /** Nulo em convite de plataforma: não existe restaurante ainda. */
  restaurantName: string | null
  role: MemberRole
}

export const changeMemberRoleSchema = z.object({
  membershipId: uuidSchema,
  role: memberRoleSchema,
})

export type MemberDTO = {
  membershipId: string
  userId: string
  email: string | null
  displayName: string | null
  role: MemberRole
  joinedAt: string
}
