import 'server-only'
import { uuidSchema } from '@/domain/common'
import {
  FEEDBACK_BUCKET,
  feedbackRefSchema,
  listFeedbackSchema,
  markFeedbackReadSchema,
  type FeedbackDTO,
  type FeedbackPage,
} from '@/domain/feedback'
import { recordAudit } from '@/server/security/audit'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, requireRestaurantAdmin, UserFacingError } from './auth'

const PAGE_SIZE = 20
const SIGNED_URL_SECONDS = 60 * 60
// A assinatura de envio vale 2 h: depois de 3 h, nenhum envio pendente
// ainda pode chegar para um rascunho.
const ABANDONED_AFTER_MS = 3 * 60 * 60 * 1000
const COLUMNS = 'id, body, published_at, read_at, restaurant_feedback_photos(id, storage_path, width, height, position)'

type PhotoRow = { id: string; storage_path: string; width: number; height: number; position: number }
type FeedbackRow = {
  id: string
  body: string
  published_at: string | null
  read_at: string | null
  restaurant_feedback_photos: PhotoRow[]
}

async function db() {
  return createUserClient(await currentTerritory())
}

type Client = Awaited<ReturnType<typeof db>>

// O bucket é privado: cada foto sai com link assinado de 1 hora, todos
// pedidos numa chamada só.
async function toDTOs(supabase: Client, rows: FeedbackRow[]): Promise<FeedbackDTO[]> {
  const paths = rows.flatMap((row) => row.restaurant_feedback_photos.map((photo) => photo.storage_path))
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
    if (error) console.error('[feedback] links assinados', error.message)
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl)
    }
  }
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    publishedAt: row.published_at ?? '',
    readAt: row.read_at,
    photos: [...row.restaurant_feedback_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        url: urls.get(photo.storage_path) ?? null,
        width: photo.width,
        height: photo.height,
        position: photo.position,
      })),
  }))
}

export async function listFeedback(input: unknown): Promise<FeedbackPage> {
  const { restaurantId, filter, cursor } = listFeedbackSchema.parse(input)
  await requireRestaurantAdmin(restaurantId)

  const supabase = await db()
  let query = supabase
    .from('restaurant_feedback')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (filter === 'unread') query = query.is('read_at', null)
  // Data e id já passaram por timestampSchema e uuidSchema.
  if (cursor) {
    query = query.or(
      `published_at.lt."${cursor.publishedAt}",and(published_at.eq."${cursor.publishedAt}",id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) throw new Error(`Não foi possível listar os feedbacks: ${error.message}`)
  const rows = (data ?? []) as FeedbackRow[]
  const page = rows.slice(0, PAGE_SIZE)
  const last = page.at(-1)
  return {
    items: await toDTOs(supabase, page),
    nextCursor: rows.length > PAGE_SIZE && last?.published_at ? { publishedAt: last.published_at, id: last.id } : null,
  }
}

export async function getFeedback(input: unknown): Promise<FeedbackDTO | null> {
  const { restaurantId, feedbackId } = feedbackRefSchema.parse(input)
  await requireRestaurantAdmin(restaurantId)
  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurant_feedback')
    .select(COLUMNS)
    .eq('id', feedbackId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw new Error(`Não foi possível ler o feedback: ${error.message}`)
  if (!data) return null
  const [feedback] = await toDTOs(supabase, [data as FeedbackRow])
  return feedback ?? null
}

// Para a casca (contador da barra e da aba). A RLS já devolve zero para
// quem não é administrador; erro vira zero para não derrubar a navegação.
export async function countUnreadFeedbackForShell(restaurantId: string): Promise<number> {
  try {
    const supabase = await db()
    const { count, error } = await supabase
      .from('restaurant_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'published')
      .is('read_at', null)
    if (error) throw error
    return count ?? 0
  } catch (error) {
    console.error('[feedback] contagem da casca', error instanceof Error ? error.message : error)
    return 0
  }
}

export async function markFeedbackRead(input: unknown): Promise<void> {
  const { restaurantId, feedbackId, read } = markFeedbackReadSchema.parse(input)
  const user = await requireRestaurantAdmin(restaurantId)
  await enforceRateLimit('mutation', `user:${user.id}`)

  const supabase = await db()
  const { data, error } = await supabase
    .from('restaurant_feedback')
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq('id', feedbackId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'published')
    .select('id')
  if (error) throw new Error(`Não foi possível atualizar o feedback: ${error.message}`)
  if (!data?.length) throw new UserFacingError('Este feedback foi excluído.')
  if (!read) return

  // A notificação da PRÓPRIA pessoa sobre este feedback também fica lida.
  // A dos outros admins continua: notificação é pessoal (spec §6.8).
  const { error: notificationError } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('kind', 'feedback_received')
    .eq('data->>feedbackId', feedbackId)
    .is('read_at', null)
  if (notificationError) console.error('[feedback] notificação não marcada', notificationError.message)
}

export async function deleteFeedback(input: unknown): Promise<void> {
  const { restaurantId, feedbackId } = feedbackRefSchema.parse(input)
  const user = await requireRestaurantAdmin(restaurantId)
  await enforceRateLimit('mutation', `user:${user.id}`)

  const supabase = await db()
  const { data: photos, error } = await supabase
    .from('restaurant_feedback_photos')
    .select('storage_path')
    .eq('feedback_id', feedbackId)
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(`Não foi possível ler as fotos: ${error.message}`)

  // Arquivos primeiro: se o storage falhar, nada é apagado e a pessoa
  // tenta de novo. O contrário deixaria fotos órfãs no bucket.
  const paths = (photos ?? []).map((photo) => photo.storage_path)
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(FEEDBACK_BUCKET).remove(paths)
    if (removeError) {
      console.error('[feedback] remoção das fotos', removeError.message)
      throw new UserFacingError('Não foi possível excluir as fotos. Tente de novo.')
    }
  }

  const { error: deleteError } = await supabase.rpc('delete_feedback', { p_feedback_id: feedbackId })
  if (deleteError) {
    if (deleteError.message === 'feedback_not_found') throw new UserFacingError('Este feedback já foi excluído.')
    throw new Error(`Não foi possível excluir o feedback: ${deleteError.message}`)
  }

  await recordAudit({
    action: 'feedback.deleted',
    subjectType: 'restaurant_feedback',
    subjectId: feedbackId,
    restaurantId,
  })
}

// Rascunhos de envios que não terminaram (aba fechada no meio). Roda quando
// um admin abre Feedbacks; erros só vão para o log.
export async function cleanupAbandonedFeedback(restaurantId: unknown): Promise<void> {
  const id = uuidSchema.parse(restaurantId)
  await requireRestaurantAdmin(id)

  const supabase = await db()
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString()
  const { data, error } = await supabase
    .from('restaurant_feedback')
    .select('id, restaurant_feedback_photos(storage_path)')
    .eq('restaurant_id', id)
    .eq('status', 'draft')
    .lt('created_at', cutoff)
    .limit(50)
  if (error) {
    console.error('[feedback] limpeza: leitura', error.message)
    return
  }
  if (!data?.length) return

  const paths = data.flatMap((row) => row.restaurant_feedback_photos.map((photo) => photo.storage_path))
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(FEEDBACK_BUCKET).remove(paths)
    if (removeError) {
      console.error('[feedback] limpeza: arquivos', removeError.message)
      return
    }
  }
  const { error: deleteError } = await supabase
    .from('restaurant_feedback')
    .delete()
    .in('id', data.map((row) => row.id))
  if (deleteError) console.error('[feedback] limpeza: rascunhos', deleteError.message)
}
