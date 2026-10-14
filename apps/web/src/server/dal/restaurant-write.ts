import 'server-only'
import { uuidSchema } from '@/domain/common'
import type { GoogleReviewOutcome, GoogleReviewStatus } from '@/domain/google-review'
import { completeOnboardingSchema, generateGoogleReviewSchema, parseContact, setPublishedSchema, setRestaurantStatusSchema, updateIdentitySchema, updateRestaurantProfileSchema, updateSlugSchema, type GoogleReview, type UpdateRestaurantProfileInput } from '@/domain/restaurant'
import type { RevalidationTarget } from '@/server/revalidate'
import { getRestaurantRevalidationTarget } from './revalidation-target'
import { countVisibleItemsWithoutMedia } from './menu-read'
import { fitContrast } from '@/lib/color'
import { isBaseInRange, PRESETS } from '@/lib/theme/presets'
import { CONTRAST_MINIMUMS } from '@/lib/theme/resolve'
import { resolveGoogleReview } from '@/server/integrations/google-review'
import { recordAudit } from '@/server/security/audit'
import { enforceRateLimit, RateLimitedError } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { ConflictError, currentTerritory, requireRestaurantAdmin, requirePlatformAdmin, UserFacingError } from './auth'

async function db() {
  return createUserClient(await currentTerritory())
}
// Monta o jsonb `contact`. O endereço do CEP substitui o texto antigo;
// sem endereço novo, o texto antigo volta como estava (o formulário o
// devolve) ou some, quando o dono escolheu "Remover endereço". O link de
// avaliação entra só como o servidor decidiu.
function storedContact(
  contact: UpdateRestaurantProfileInput['contact'],
  googleReview: GoogleReview | null,
): Record<string, unknown> {
  const { address, legacyAddress, ...rest } = contact
  const stored: Record<string, unknown> = { ...rest }
  if (address) stored.address = address
  else if (legacyAddress) stored.address = legacyAddress
  if (googleReview) stored.googleReview = googleReview
  return stored
}

type ReviewDecision = { review: GoogleReview | null; status: GoogleReviewStatus }

// A resolução nunca impede salvar o resto do Contato: limite estourado e
// Google fora do ar viram status, não erro.
async function decideGoogleReview(
  userId: string,
  mapsUrl: string | undefined,
  current: GoogleReview | undefined,
): Promise<ReviewDecision> {
  if (!mapsUrl) return { review: null, status: 'none' }
  if (current && current.mapsUrl === mapsUrl) return { review: current, status: 'active' }
  try {
    await enforceRateLimit('maps:resolve', `user:${userId}`)
  } catch (error) {
    if (error instanceof RateLimitedError) return { review: null, status: 'unavailable' }
    throw error
  }
  const resolved = await resolveGoogleReview(mapsUrl)
  if (resolved.status === 'ok') return { review: { url: resolved.url, mapsUrl }, status: 'active' }
  return { review: null, status: resolved.status }
}

async function readContact(restaurantId: string): Promise<unknown> {
  const supabase = await db()
  const { data, error } = await supabase.from('restaurants').select('contact').eq('id', restaurantId).maybeSingle()
  if (error) throw new Error(`Não foi possível ler o contato: ${error.message}`)
  if (!data) throw new UserFacingError('Restaurante não encontrado.')
  return data.contact
}

export type ProfileSaveResult = GoogleReviewOutcome & { target: RevalidationTarget }

export async function updateRestaurantProfile(input: unknown): Promise<ProfileSaveResult> {
  const data = updateRestaurantProfileSchema.parse(input)
  // Autorizacao por POSSE do recurso, nao so por estar autenticado. E o
  // que fecha IDOR: saber o id de outro restaurante nao basta.
  const user = await requireRestaurantAdmin(data.restaurantId)

  const current = parseContact(await readContact(data.restaurantId))
  const decision = await decideGoogleReview(user.id, data.contact.mapsUrl, current.googleReview)

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({
      name: data.name,
      description: data.description ?? null,
      contact: storedContact(data.contact, decision.review),
    })
    .eq('id', data.restaurantId)

  if (error) throw new Error(`Não foi possível salvar: ${error.message}`)

  await recordAudit({
    action: 'restaurant.profile_updated',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
  })

  return {
    target: await getRestaurantRevalidationTarget(data.restaurantId),
    googleReview: decision.status,
    googleReviewUrl: decision.review?.url ?? null,
  }
}

// "Gerar agora": para restaurante que salvou o Maps antes deste recurso, ou
// quando o Google estava fora do ar. Regrava SÓ a chave googleReview; o resto
// do jsonb volta exatamente como foi lido.
export async function generateGoogleReview(input: unknown): Promise<ProfileSaveResult> {
  const { restaurantId } = generateGoogleReviewSchema.parse(input)
  const user = await requireRestaurantAdmin(restaurantId)

  const raw = await readContact(restaurantId)
  const mapsUrl = parseContact(raw).mapsUrl
  if (!mapsUrl) throw new UserFacingError('Salve um link do Google Maps antes de gerar o botão de avaliação.')

  await enforceRateLimit('maps:resolve', `user:${user.id}`)
  const resolved = await resolveGoogleReview(mapsUrl)

  const next: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
  if (resolved.status === 'ok') next.googleReview = { url: resolved.url, mapsUrl }
  else delete next.googleReview

  const supabase = await db()
  const { error } = await supabase.from('restaurants').update({ contact: next }).eq('id', restaurantId)
  if (error) throw new Error(`Não foi possível salvar o link de avaliação: ${error.message}`)

  return {
    target: await getRestaurantRevalidationTarget(restaurantId),
    googleReview: resolved.status === 'ok' ? 'active' : resolved.status,
    googleReviewUrl: resolved.status === 'ok' ? resolved.url : null,
  }
}

export async function setRestaurantStatus(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = setRestaurantStatusSchema.parse(input)
  await requirePlatformAdmin()

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({ status: data.status })
    .eq('id', data.restaurantId)

  if (error) {
    throw new Error(`Não foi possível alterar a situação: ${error.message}`)
  }

  await recordAudit({
    action: 'restaurant.status_changed',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
    metadata: { status: data.status },
  })

  return getRestaurantRevalidationTarget(data.restaurantId)
}

// Grava a marca uma vez só: o `is(null)` torna a segunda chamada inofensiva.
export async function completeOnboarding(input: unknown): Promise<RevalidationTarget> {
  const data = completeOnboardingSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', data.restaurantId)
    .is('onboarding_completed_at', null)

  if (error) {
    throw new Error(`Não foi possível concluir os primeiros passos: ${error.message}`)
  }

  return getRestaurantRevalidationTarget(data.restaurantId)
}

export async function setPublished(input: unknown): Promise<RevalidationTarget> {
  const data = setPublishedSchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  const supabase = await db()

  if (data.published) {
    // Publicar cardápio vazio só produz cliente confuso na mesa. A conferência
    // é uma consulta, e não uma regra de banco, porque "ao menos um item
    // visível" muda com o produto, e travar isso num CHECK seria rigidez.
    const { count, error: countError } = await supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', data.restaurantId)
      .eq('is_visible', true)

    if (countError) {
      throw new Error(`Não foi possível conferir o cardápio: ${countError.message}`)
    }
    if ((count ?? 0) === 0) {
      throw new UserFacingError(
        'Adicione ao menos um item visível antes de publicar o cardápio.',
      )
    }

    // Mídia é obrigatória a partir da Fase 4, e a recusa mora AQUI e não na
    // criação do item. Recusar na criação obrigaria o dono a ter oitenta
    // fotos antes de digitar o primeiro nome, e ele desistiria no meio.
    // Recusar na publicação diz: monte à vontade, mas o cliente não vê
    // cardápio pela metade.
    //
    // Restaurante que JÁ está no ar não é tocado: esta conferência só roda
    // em `published: true`, então quem publicou antes da Fase 4 continua
    // publicado até a próxima publicação.
    const missingMedia = await countVisibleItemsWithoutMedia(data.restaurantId)
    if (missingMedia > 0) {
      throw new UserFacingError(
        missingMedia === 1
          ? 'Um item visível ainda está sem foto nem vídeo. Adicione a mídia dele antes de publicar.'
          : `${missingMedia} itens visíveis ainda estão sem foto nem vídeo. Adicione a mídia deles antes de publicar.`,
      )
    }
  }

  const { error } = await supabase
    .from('restaurants')
    .update({ status: data.published ? 'active' : 'draft' })
    .eq('id', data.restaurantId)

  if (error) {
    // O gatilho do 0011 recusa entrar ou sair de 'suspended' para quem não é
    // plataforma. Traduzir aqui evita mostrar errcode do Postgres na tela.
    if (error.code === '42501') {
      throw new UserFacingError(
        'Este restaurante está suspenso. Fale com o administrador da plataforma.',
      )
    }
    throw new Error(`Não foi possível alterar a publicação: ${error.message}`)
  }

  await recordAudit({
    action: data.published ? 'restaurant.published' : 'restaurant.unpublished',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
  })

  return getRestaurantRevalidationTarget(data.restaurantId)
}

// O assistente pergunta isto a cada tecla digitada. O balde é o mesmo do
// preview de convite, porque sem limite este endpoint vira um enumerador
// barato de endereços — ainda que o endereço já seja público por natureza.

export async function updateIdentity(
  input: unknown,
): Promise<RevalidationTarget> {
  const data = updateIdentitySchema.parse(input)
  await requireRestaurantAdmin(data.restaurantId)

  // A faixa do preset e o contraste são conferidos AQUI, no servidor, e não
  // só no seletor de cor. Um seletor é conveniência; a regra é isto.
  if (data.theme.base && !isBaseInRange(data.theme.preset, data.theme.base)) {
    throw new UserFacingError(
      'Esta cor de fundo não combina com o tema escolhido. Escolha um tom dentro da faixa sugerida.',
    )
  }

  if (data.theme.accent) {
    const preset = PRESETS[data.theme.preset]
    const fundoClaro = data.theme.base ?? preset.light.base
    const fundoEscuro = preset.dark.base

    // As DUAS faces, e não só a clara. A versão anterior conferia apenas
    // `preset.light.base`, e foi por isso que um destaque aprovado no claro
    // foi parar a 1,1:1 num cardápio escuro no ar.
    //
    // E o piso é 4,5 e não 3: o destaque pinta o nome da categoria e o
    // preço, que são TEXTO. 3:1 é o limiar de elemento de interface.
    //
    // A conferência é por `fitContrast`, e não por `contrastRatio`: o
    // `resolveTheme` deriva a cor por face, então o que precisa ser possível
    // é a DERIVAÇÃO, não a cor crua. Recusar por `contrastRatio` barraria
    // cores de marca legítimas que o sistema sabe adaptar.
    const reprovadas: string[] = []
    if (fitContrast(data.theme.accent, fundoClaro, CONTRAST_MINIMUMS.accent) === null) {
      reprovadas.push('clara')
    }
    if (fitContrast(data.theme.accent, fundoEscuro, CONTRAST_MINIMUMS.accent) === null) {
      reprovadas.push('escura')
    }

    if (reprovadas.length > 0) {
      throw new UserFacingError(
        reprovadas.length === 2
          ? 'Esta cor de destaque não fica legível em nenhuma das duas versões do cardápio. Escolha um tom mais vivo ou menos acinzentado.'
          : `Esta cor de destaque não fica legível na versão ${reprovadas[0]} do cardápio, que é a que aparece quando o celular do cliente está nesse modo. Escolha um tom mais vivo ou menos acinzentado.`,
      )
    }
  }

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({
      segment: data.segment ?? null,
      theme: data.theme,
      menu_presentation: data.menuPresentation,
    })
    .eq('id', data.restaurantId)

  if (error) throw new Error(`Não foi possível salvar: ${error.message}`)

  await recordAudit({
    action: 'restaurant.identity_updated',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
    metadata: {
      preset: data.theme.preset,
      segment: data.segment ?? null,
      menuPresentation: data.menuPresentation,
    },
  })

  return getRestaurantRevalidationTarget(data.restaurantId)
}

export async function softDeleteRestaurant(
  restaurantId: unknown,
): Promise<RevalidationTarget> {
  const id = uuidSchema.parse(restaurantId)
  await requirePlatformAdmin()

  // O alvo é lido ANTES da remoção. Depois dela o cardápio público precisa
  // parar de responder, e é justamente o caminho `/{slug}` que tem de ser
  // invalidado — buscar o slug depois de marcar `deleted_at` dependeria de
  // a consulta continuar enxergando a linha, o que não é garantido.
  const revalidationTarget = await getRestaurantRevalidationTarget(id)

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Não foi possível remover: ${error.message}`)

  await recordAudit({
    action: 'restaurant.soft_deleted',
    subjectType: 'restaurant',
    subjectId: id,
    restaurantId: id,
  })

  return revalidationTarget
}

export async function updateRestaurantSlug(
  input: unknown,
): Promise<RevalidationTarget & { oldSlug: string }> {
  const data = updateSlugSchema.parse(input)
  // Só a plataforma troca o endereço. O gatilho no banco recusaria de
  // qualquer forma; esta linha dá a mensagem decente antes de chegar lá.
  await requirePlatformAdmin()

  // O endereço ANTIGO precisa ser invalidado junto com o novo: sem isso
  // `/{slugAntigo}` continuaria servindo o cardápio de um endereço que já
  // não existe. É a única escrita do projeto em que o alvo de antes e o de
  // depois são caminhos diferentes.
  const { slug: oldSlug } = await getRestaurantRevalidationTarget(data.restaurantId)

  const supabase = await db()
  const { error } = await supabase
    .from('restaurants')
    .update({ slug: data.slug })
    .eq('id', data.restaurantId)

  if (error) {
    if (error.code === '23505') {
      throw new ConflictError('Este endereço já está em uso.')
    }
    throw new Error(`Não foi possível alterar o endereço: ${error.message}`)
  }

  await recordAudit({
    action: 'restaurant.slug_changed',
    subjectType: 'restaurant',
    subjectId: data.restaurantId,
    restaurantId: data.restaurantId,
    metadata: { slug: data.slug },
  })

  return { id: data.restaurantId, slug: data.slug, oldSlug }
}
