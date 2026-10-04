import 'server-only'
import { ZodError } from 'zod'
import { UserFacingError } from '@/server/dal/auth'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('digest' in error)) {
    return false
  }
  const digest = (error as { digest: unknown }).digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') ||
      digest.startsWith('NEXT_NOT_FOUND') ||
      digest.startsWith('NEXT_HTTP_ERROR_FALLBACK'))
  )
}

export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    if (isNextControlFlow(error)) throw error

    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? 'Dados inválidos' }
    }
    if (error instanceof UserFacingError) {
      return { ok: false, error: error.message }
    }

    console.error('[action]', error)
    return { ok: false, error: 'Não foi possível concluir a operação.' }
  }
}
