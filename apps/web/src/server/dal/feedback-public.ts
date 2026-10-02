import 'server-only'
import { randomUUID } from 'node:crypto'
import { FEEDBACK_BUCKET, publishFeedbackSchema, startFeedbackSchema, type StartedFeedback } from '@/domain/feedback'
import { env } from '@/server/env'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit, RateLimitedError, type RateLimitBucket } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { UserFacingError } from './auth'

const MESSAGES: Record<string, string> = {
  feedback_unavailable: 'Este cardápio não está recebendo feedback agora.',
  feedback_capped: 'Este restaurante recebeu muitos feedbacks agora há pouco. Tente de novo em alguns minutos.',
  feedback_expired: 'O envio demorou demais. Toque em Enviar de novo.',
  feedback_invalid: 'Revise o texto e as fotos e tente de novo.',
}
const GENERIC = 'Não foi possível enviar agora. Tente de novo mais tarde.'

// Cada recusa do banco tem código próprio (0030). Código desconhecido —
// inclusive `server_key`, que é configuração errada — vira a mensagem
// genérica, e o código real vai para o log. Nunca o texto do feedback.
function refuse(error: { message: string; details?: string | null; code?: string }): never {
  if (error.message === 'feedback_photo_missing') {
    throw new UserFacingError(`A foto ${error.details ?? ''} não chegou ao servidor. Toque em Enviar de novo.`)
  }
  const message = MESSAGES[error.message]
  if (message) throw new UserFacingError(message)
  console.error('[feedback] recusa não mapeada', error.code, error.message)
  throw new UserFacingError(GENERIC)
}

async function limit(bucket: RateLimitBucket, scope: string) {
  try {
    await enforceRateLimit(bucket, `${await rateLimitIdentity()}:${scope}`)
  } catch (error) {
    if (error instanceof RateLimitedError) {
      throw new UserFacingError('Você enviou vários feedbacks em pouco tempo. Tente de novo em alguns minutos.')
    }
    throw error
  }
}

// Sempre o cliente anônimo (território público, sem cookie de sessão),
// mesmo se alguém chamar a ação de outro host.
async function anonymousClient() {
  return createUserClient('site')
}

export async function beginFeedback(input: unknown): Promise<StartedFeedback> {
  const data = startFeedbackSchema.parse(input)
  // Campo-armadilha preenchido: finge sucesso sem gravar nada.
  if (data.website) return { feedbackId: randomUUID(), uploads: [] }
  await limit('feedback:start', data.slug)

  const supabase = await anonymousClient()
  const { data: rows, error } = await supabase.rpc('begin_feedback', {
    p_key: env.APP_SERVER_KEY,
    p_slug: data.slug,
    p_body: data.body,
    p_photos: data.photos,
  })
  if (error) refuse(error)

  const list = rows ?? []
  const feedbackId = list[0]?.feedback_id
  if (!feedbackId) {
    console.error('[feedback] begin_feedback sem linhas')
    throw new UserFacingError(GENERIC)
  }

  // A assinatura passa pela política de storage do 0030: só caminho
  // reservado por este rascunho é aceito.
  const uploads: StartedFeedback['uploads'] = []
  for (const row of list) {
    if (!row.storage_path) continue
    const { data: ticket, error: signError } = await supabase.storage
      .from(FEEDBACK_BUCKET)
      .createSignedUploadUrl(row.storage_path)
    if (signError || !ticket) {
      console.error('[feedback] assinatura do envio', signError?.message)
      throw new UserFacingError('Não foi possível preparar o envio das fotos. Tente de novo.')
    }
    uploads.push({ position: row.photo_position ?? uploads.length, signedUrl: ticket.signedUrl })
  }
  return { feedbackId, uploads }
}

export async function publishFeedback(input: unknown): Promise<{ published: boolean }> {
  const data = publishFeedbackSchema.parse(input)
  if (data.website) return { published: false }
  await limit('feedback:publish', 'publicar')

  const supabase = await anonymousClient()
  const { error } = await supabase.rpc('publish_feedback', {
    p_key: env.APP_SERVER_KEY,
    p_feedback_id: data.feedbackId,
  })
  if (error) refuse(error)
  return { published: true }
}
