import 'server-only'
import { ZodError } from 'zod'
import { UserFacingError } from '@/server/dal/auth'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// redirect() e notFound() do Next funcionam LANCANDO. Se o catch abaixo
// engolisse essas excecoes, todo redirecionamento dentro de uma action
// viraria silenciosamente uma mensagem de erro generica -- um bug
// desconcertante de diagnosticar, porque a tela simplesmente nao navega.
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
    // Testa a BASE, não cada filha. Um erro previsto novo passa a chegar
    // na tela sem exigir que alguém lembre de atualizar esta linha.
    if (error instanceof UserFacingError) {
      return { ok: false, error: error.message }
    }

    // Erro inesperado nao viaja para o cliente. Mensagem do Postgres traz
    // nome de tabela, coluna e constraint -- um mapa do schema de graca
    // para quem estiver sondando.
    console.error('[action]', error)
    return { ok: false, error: 'Não foi possível concluir a operação.' }
  }
}
