import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  changeMemberRoleSchema,
  type MemberDTO,
  type MemberRole,
} from '@/domain/invite'
import type { RevalidationTarget } from '@/server/revalidate'
import { recordAudit } from '@/server/security/audit'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import { currentTerritory, requireRestaurantAdmin, UserFacingError } from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

export async function listMembers(restaurantId: unknown): Promise<MemberDTO[]> {
  const id = uuidSchema.parse(restaurantId)
  // A função no banco já checa pertencimento, mas checamos aqui também: as
  // duas camadas concordam, e uma falha em qualquer uma é contida pela outra.
  await requireRestaurantAdmin(id)

  const supabase = await db()
  const { data, error } = await supabase.rpc('list_restaurant_members', {
    p_restaurant_id: id,
  })

  if (error) {
    throw new Error(`Não foi possível listar a equipe: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.member_role as MemberRole,
    joinedAt: row.joined_at,
  }))
}

// Compartilhada entre trocar papel e remover, porque as duas quebram a mesma
// garantia se passarem: um restaurante sem administrador não tem quem edite o
// cardápio nem quem convide alguém, e só sai desse estado por intervenção
// manual no banco.
//
// O gatilho `memberships_guard_last_admin` recusaria de qualquer forma. Esta
// checagem existe para a mensagem na tela dizer o que aconteceu, em vez de
// vazar um errcode do Postgres.
async function assertNotLastAdmin(
  restaurantId: string,
  membershipId: string,
): Promise<void> {
  const supabase = await db()
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('role', 'admin')
    .neq('id', membershipId)

  if (error) {
    throw new Error(`Não foi possível conferir a equipe: ${error.message}`)
  }
  if ((count ?? 0) === 0) {
    throw new UserFacingError(
      'Este é o único administrador. Promova outra pessoa antes de mudar este papel.',
    )
  }
}

export async function changeMemberRole(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = changeMemberRoleSchema.parse(input)

  const supabase = await db()
  // Descobrimos o restaurante dono ANTES de autorizar. Confiar num
  // restaurantId vindo do cliente seria exatamente a brecha de IDOR.
  const { data: row, error: lookupError } = await supabase
    .from('memberships')
    .select('restaurant_id, user_id, role')
    .eq('id', data.membershipId)
    .single()

  if (lookupError || !row) throw new UserFacingError('Membro não encontrado.')
  await requireRestaurantAdmin(row.restaurant_id)

  // Trocar um papel pelo mesmo papel não é erro, é nada. Sair cedo evita uma
  // escrita e um registro de auditoria sobre um evento que não aconteceu.
  //
  // O alvo volta mesmo assim: revalidar o que não mudou custa uma varrida de
  // cache e nada mais, e devolver a forma certa em todos os caminhos é o que
  // permite a assinatura ser `Promise<RevalidationTarget>` e não anulável.
  if (row.role === data.role) return getRestaurantRevalidationTarget(row.restaurant_id)

  if (row.role === 'admin') {
    await assertNotLastAdmin(row.restaurant_id, data.membershipId)
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role: data.role })
    .eq('id', data.membershipId)

  if (error) throw new Error(`Não foi possível trocar o papel: ${error.message}`)

  await recordAudit({
    action: 'membership.role_changed',
    subjectType: 'membership',
    subjectId: data.membershipId,
    restaurantId: row.restaurant_id,
    metadata: { from: row.role, to: data.role, targetUserId: row.user_id },
  })

  return getRestaurantRevalidationTarget(row.restaurant_id)
}

export async function removeMember(
  membershipId: unknown,
): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(membershipId)

  const supabase = await db()
  // Descobrimos o restaurante dono ANTES de autorizar. Confiar num
  // restaurantId vindo do cliente seria exatamente a brecha de IDOR.
  const { data: row, error: lookupError } = await supabase
    .from('memberships')
    .select('restaurant_id, user_id, role')
    .eq('id', id)
    .single()

  if (lookupError || !row) throw new UserFacingError('Membro não encontrado.')
  await requireRestaurantAdmin(row.restaurant_id)

  if (row.role === 'admin') {
    await assertNotLastAdmin(row.restaurant_id, id)
  }

  const { error } = await supabase.from('memberships').delete().eq('id', id)
  if (error) {
    throw new Error(`Não foi possível remover o membro: ${error.message}`)
  }

  await recordAudit({
    action: 'membership.removed',
    subjectType: 'membership',
    subjectId: id,
    restaurantId: row.restaurant_id,
    metadata: { removedUserId: row.user_id },
  })

  return getRestaurantRevalidationTarget(row.restaurant_id)
}
