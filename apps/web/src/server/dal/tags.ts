import 'server-only'
import { z } from 'zod'
import { uuidSchema } from '@/domain/common'
import {
  createTagSchema,
  tagTokenSchema,
  updateTagSchema,
  type ResolvedTagDTO,
  type NfcEventDTO,
  type TagDTO,
} from '@/domain/tag'
import { recordAudit } from '@/server/security/audit'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { generateTagToken } from '@/server/security/tokens'
import type { RevalidationTarget } from '@/server/revalidate'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { createUserClient } from './_client'
import {
  currentTerritory,
  ConflictError,
  requireMember,
  requirePlatformAdmin,
  requireRestaurantAdmin,
} from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}

// `{ tag }` aninhado, e não `TagDTO & RevalidationTarget`: as duas formas têm
// campo `id`, e uma interseção faria o id do identificador e o do restaurante
// disputarem a mesma chave — exatamente o tipo de armadilha silenciosa que
// esta fase existe para tirar do caminho.
export async function createTag(
  input: unknown,
): Promise<RevalidationTarget & { tag: TagDTO }> {
  const data = createTagSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()

  // Colisao em 2^80 e praticamente impossivel, mas quem garante e o unique
  // do banco. Tres tentativas cobrem o caso raro sem virar loop infinito.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const publicToken = generateTagToken()
    const { data: row, error } = await supabase
      .from('menu_tags')
      .insert({
        restaurant_id: data.restaurantId,
        public_token: publicToken,
        label: data.label ?? null,
        table_number: data.tableNumber,
      })
      .select('id, public_token, label, table_number, is_active, last_seen_at, nfc_serial, nfc_verified_at, nfc_protected_at')
      .single()

    if (!error && row) {
      await recordAudit({
        action: 'tag.created',
        subjectType: 'menu_tag',
        subjectId: row.id as string,
        restaurantId: data.restaurantId,
      })
      return {
        ...(await getRestaurantRevalidationTarget(data.restaurantId)),
        tag: {
          id: row.id as string,
          publicToken: row.public_token as string,
          label: row.label as string | null,
          tableNumber: row.table_number as number | null,
          isActive: row.is_active as boolean,
          lastSeenAt: row.last_seen_at as string | null,
          nfcSerial: row.nfc_serial as string | null,
          nfcVerifiedAt: row.nfc_verified_at as string | null,
          nfcProtectedAt: row.nfc_protected_at as string | null,
        },
      }
    }

    // 23505 e violacao de unique: so nesse caso vale tentar outro token.
    if (error?.code === '23505') {
      if (error.message.includes('menu_tags_active_table_number_key')) {
        throw new ConflictError('Já existe um identificador ativo para essa mesa.')
      }
      continue
    }
    if (error) {
      throw new Error(`Não foi possível criar o identificador: ${error.message}`)
    }
  }

  throw new Error('Não foi possível gerar o identificador. Tente de novo.')
}

export async function listTags(restaurantId: unknown): Promise<TagDTO[]> {
  const id = uuidSchema.parse(restaurantId)
  await requireMember(id)

  const supabase = await db()
  const { data, error } = await supabase
    .from('menu_tags')
    .select('id, public_token, label, table_number, is_active, last_seen_at, nfc_serial, nfc_verified_at, nfc_protected_at')
    .eq('restaurant_id', id)
    .order('created_at')

  if (error) {
    throw new Error(`Não foi possível listar identificadores: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    publicToken: row.public_token as string,
    label: row.label as string | null,
    tableNumber: row.table_number as number | null,
    isActive: row.is_active as boolean,
    lastSeenAt: row.last_seen_at as string | null,
    nfcSerial: row.nfc_serial as string | null,
    nfcVerifiedAt: row.nfc_verified_at as string | null,
    nfcProtectedAt: row.nfc_protected_at as string | null,
  }))
}

export async function updateTag(input: unknown): Promise<RevalidationTarget> {
  const data = updateTagSchema.parse(input)

  const supabase = await db()
  const { data: row, error: lookupError } = await supabase
    .from('menu_tags')
    .select('restaurant_id')
    .eq('id', data.tagId)
    .single()

  if (lookupError || !row) throw new Error('Identificador não encontrado')
  const restaurantId = row.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)

  // public_token e restaurant_id nao aparecem aqui: o gatilho no banco
  // recusaria a alteracao de qualquer forma.
  const { error } = await supabase
    .from('menu_tags')
    .update({ table_number: data.tableNumber, is_active: data.isActive })
    .eq('id', data.tagId)

  if (error) {
    if (error.code === '23505' && error.message.includes('menu_tags_active_table_number_key')) {
      throw new ConflictError('Já existe um identificador ativo para essa mesa.')
    }
    throw new Error(`Não foi possível salvar o identificador: ${error.message}`)
  }

  return getRestaurantRevalidationTarget(restaurantId)
}

export async function deleteTag(tagId: unknown): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(tagId)
  await requirePlatformAdmin()

  const supabase = await db()

  // O restaurante do identificador é lido ANTES do delete: depois, a linha não
  // existe mais e não haveria de onde tirar o alvo da revalidação.
  const { data: row, error: lookupError } = await supabase
    .from('menu_tags')
    .select('restaurant_id')
    .eq('id', id)
    .single()

  if (lookupError || !row) throw new Error('Identificador não encontrado')
  const revalidationTarget = await getRestaurantRevalidationTarget(row.restaurant_id as string)

  const { error } = await supabase.from('menu_tags').delete().eq('id', id)
  if (error) {
    throw new Error(`Não foi possível remover o identificador: ${error.message}`)
  }

  await recordAudit({
    action: 'tag.deleted',
    subjectType: 'menu_tag',
    subjectId: id,
  })

  return revalidationTarget
}

const nfcEventSchema = z.object({
  tagId: uuidSchema,
  operationId: uuidSchema,
  event: z.enum(['started', 'failed', 'verified', 'protected']),
  serial: z.string().regex(/^[0-9A-F]{14}$/),
  reason: z.enum(['write_error', 'read_error', 'wrong_tag', 'wrong_url', 'cancelled', 'protection_error']).nullable().optional(),
}).superRefine((data, context) => {
  const hasReason = data.reason != null
  if ((data.event === 'failed') !== hasReason) {
    context.addIssue({ code: 'custom', message: 'Informe o motivo somente para operações que falharam.', path: ['reason'] })
  }
})

export async function recordNfcEvent(input: unknown): Promise<{ verifiedAt: string | null; protectedAt: string | null; revalidationTarget: RevalidationTarget | null }> {
  const data = nfcEventSchema.parse(input)
  const supabase = await db()
  const { data: tag, error: lookupError } = await supabase
    .from('menu_tags')
    .select('restaurant_id')
    .eq('id', data.tagId)
    .single()
  if (lookupError || !tag) throw new Error('Identificador não encontrado')
  const restaurantId = tag.restaurant_id as string
  await requireRestaurantAdmin(restaurantId)

  const { data: verifiedAt, error } = await supabase.rpc('record_menu_tag_nfc_event', {
    p_tag_id: data.tagId,
    p_operation_id: data.operationId,
    p_event: data.event,
    p_serial: data.serial,
    p_reason: data.reason ?? null,
  })
  if (error) {
    if (error.code === '23505') throw new ConflictError('Esta etiqueta já está vinculada a outro identificador.')
    if (error.message.includes('nfc_operation_not_started')) throw new ConflictError('O registro expirou. Leia a etiqueta novamente.')
    if (error.message.includes('nfc_operation_not_verified')) throw new ConflictError('A conferência dessa operação não foi encontrada. Leia a etiqueta novamente.')
    if (error.message.includes('nfc_tag_already_protected')) throw new ConflictError('Esta etiqueta já está protegida e não pode ser regravada.')
    if (error.message.includes('nfc_binding_changed')) throw new ConflictError('O vínculo da etiqueta mudou. Leia e confira novamente antes de sincronizar.')
    throw new Error(`Não foi possível registrar a operação NFC: ${error.message}`)
  }
  return {
    verifiedAt: data.event === 'verified' ? verifiedAt as string | null : null,
    protectedAt: data.event === 'protected' ? verifiedAt as string | null : null,
    revalidationTarget: data.event === 'verified' || data.event === 'protected'
      ? await getRestaurantRevalidationTarget(restaurantId)
      : null,
  }
}

export async function listNfcEvents(tagId: unknown): Promise<NfcEventDTO[]> {
  const id = uuidSchema.parse(tagId)
  const supabase = await db()
  const { data: tag, error: lookupError } = await supabase
    .from('menu_tags')
    .select('restaurant_id')
    .eq('id', id)
    .single()
  if (lookupError || !tag) throw new Error('Identificador não encontrado')
  await requireRestaurantAdmin(tag.restaurant_id as string)
  const { data, error } = await supabase.rpc('list_menu_tag_nfc_events', { p_tag_id: id })
  if (error) throw new Error(`Não foi possível consultar o histórico NFC: ${error.message}`)
  return (data ?? []).map((row) => ({
    action: row.action.replace('tag.nfc.', '') as NfcEventDTO['action'],
    serial: row.serial,
    reason: row.reason,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }))
}

export async function resolveTag(
  token: unknown,
): Promise<ResolvedTagDTO | null> {
  await enforceRateLimit('tag:resolve', await rateLimitIdentity())

  const parsed = tagTokenSchema.safeParse(token)
  if (!parsed.success) return null

  const supabase = await db()
  const { data, error } = await supabase.rpc('resolve_menu_tag', {
    p_token: parsed.data,
  })

  if (error || !data || data.length === 0) return null
  return {
    restaurantSlug: data[0].restaurant_slug as string,
    tagLabel: data[0].tag_label as string | null,
    tableNumber: data[0].table_number as number | null,
  }
}
