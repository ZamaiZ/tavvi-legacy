import 'server-only'
import { cache } from 'react'
import { plainTextSchema, slugSchema, uuidSchema } from '@/domain/common'
import type { RestaurantDetailDTO, RestaurantAdminDTO, RestaurantMemberDTO, RestaurantPickerDTO, RestaurantPublicDTO, RestaurantResponsibleDTO, RestaurantStatus } from '@/domain/restaurant'
import type { MemberRole } from '@/domain/invite'
import { parseContact } from '@/domain/restaurant'
import { parseMenuPresentation } from '@/domain/menu-presentation'
import { nextSlugCandidate, slugify } from '@/lib/slug'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, requirePlatformAdmin, requireUser } from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}
type AdminRow = {
  id: string
  slug: string
  name: string
  status: RestaurantStatus
  segment: string | null
  created_at: string
  deleted_at: string | null
}

function toAdminDTO(row: AdminRow): RestaurantAdminDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    segment: row.segment,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }
}

export async function checkSlug(candidate: unknown): Promise<boolean> {
  await requireUser()
  await enforceRateLimit('invite:preview', await rateLimitIdentity())

  const parsed = slugSchema.safeParse(candidate)
  // Endereço fora do formato nunca chega ao banco.
  if (!parsed.success) return false

  const supabase = await db()
  const { data, error } = await supabase.rpc('is_slug_available', {
    p_slug: parsed.data,
  })
  return !error && data === true
}

// Deriva do nome e, se já existir, sufixa até achar um livre. O teto de dez
// existe porque onze restaurantes com o mesmo nome é outro problema, e um
// laço sem teto contra o banco é um pedido de negação de serviço.
export async function suggestSlug(name: unknown): Promise<string | null> {
  const parsedName = plainTextSchema(120, 2).safeParse(name)
  if (!parsedName.success) return null

  const base = slugify(parsedName.data)
  if (await checkSlug(base)) return base

  for (let attempt = 2; attempt <= 10; attempt += 1) {
    const candidate = nextSlugCandidate(base, attempt)
    if (await checkSlug(candidate)) return candidate
  }
  return null
}

export async function listRestaurantsForAdmin(): Promise<RestaurantAdminDTO[]> {
  await requirePlatformAdmin()

  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, slug, name, status, segment, created_at, deleted_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Não foi possível listar: ${error.message}`)
  return ((data ?? []) as AdminRow[]).map(toAdminDTO)
}

export const listMyRestaurants = cache(async (): Promise<RestaurantPickerDTO[]> => {
  const user = await requireUser()

  const supabase = await db()
  // O !inner em memberships limita aos restaurantes de que a pessoa
  // participa, e o filtro em memberships.user_id traz o papel DELA (e não o
  // de outro membro do mesmo restaurante). A RLS ja garantiria o recorte; o
  // filtro explicito existe porque a DAL nao delega sua decisao ao banco.
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, slug, name, description, status, logo_path, cover_path, contact, segment, theme, menu_presentation, onboarding_completed_at, memberships!inner(user_id, role)',
    )
    .eq('memberships.user_id', user.id)
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(`Não foi possível listar: ${error.message}`)

  return (data ?? []).map((row) => {
    const membership = (row.memberships as { role: MemberRole }[] | null)?.[0]
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      status: row.status as RestaurantStatus,
      logoPath: row.logo_path as string | null,
      coverPath: row.cover_path as string | null,
      contact: parseContact(row.contact),
      segment: row.segment as string | null,
      theme: row.theme,
      menuPresentation: parseMenuPresentation(row.menu_presentation),
      onboardingCompletedAt: row.onboarding_completed_at as string | null,
      role: membership?.role ?? null,
    }
  })
})

export async function getRestaurantForMember(
  restaurantId: unknown,
): Promise<RestaurantMemberDTO | null> {
  const id = uuidSchema.parse(restaurantId)
  await requireUser()

  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id, slug, name, description, status, logo_path, cover_path, contact, segment, theme, menu_presentation, onboarding_completed_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error('Não foi possível carregar o restaurante.', {
      cause: error,
    })
  }
  if (!data) return null

  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    description: data.description as string | null,
    status: data.status as RestaurantStatus,
    logoPath: data.logo_path as string | null,
    coverPath: data.cover_path as string | null,
    contact: parseContact(data.contact),
    segment: data.segment as string | null,
    theme: data.theme,
    menuPresentation: parseMenuPresentation(data.menu_presentation),
    onboardingCompletedAt: data.onboarding_completed_at as string | null,
  }
}

export async function getRestaurantForAdmin(
  restaurantId: unknown,
): Promise<RestaurantDetailDTO | null> {
  const id = uuidSchema.parse(restaurantId)
  await requirePlatformAdmin()

  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, slug, name, description, status, contact, created_at, updated_at, segment, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error('Não foi possível carregar o restaurante.', {
      cause: error,
    })
  }
  if (!data) return null

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    status: data.status,
    contact: parseContact(data.contact),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    segment: data.segment,
    deletedAt: data.deleted_at,
  }
}

// Responsáveis para a consulta do console. Usa a mesma RPC da equipe, que já
// libera o administrador da plataforma (`is_platform_admin()`); checamos aqui
// também, como nas outras leituras de admin.
export async function listRestaurantMembersForAdmin(
  restaurantId: unknown,
): Promise<RestaurantResponsibleDTO[]> {
  const id = uuidSchema.parse(restaurantId)
  await requirePlatformAdmin()

  const supabase = await db()
  const { data, error } = await supabase.rpc('list_restaurant_members', {
    p_restaurant_id: id,
  })
  if (error) {
    throw new Error('Não foi possível carregar os responsáveis.', { cause: error })
  }

  return (data ?? []).map((row) => ({
    id: row.membership_id,
    name: row.display_name?.trim() || row.email.split('@')[0],
    email: row.email,
    role: row.member_role as MemberRole,
  }))
}

export async function getRestaurantBySlugPublic(
  slug: unknown,
): Promise<RestaurantPublicDTO | null> {
  const parsed = slugSchema.safeParse(slug)
  // Slug fora do formato nunca chega ao banco. Nao e so validacao: e um
  // filtro de entrada antes de qualquer consulta.
  if (!parsed.success) return null

  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurants')
    .select('slug, name, description, logo_path, cover_path, contact')
    .eq('slug', parsed.data)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null

  return {
    slug: data.slug as string,
    name: data.name as string,
    description: data.description as string | null,
    logoPath: data.logo_path as string | null,
    coverPath: data.cover_path as string | null,
    contact: parseContact(data.contact),
  }
}
