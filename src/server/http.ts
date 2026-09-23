import { ZodError } from 'zod'

export class HttpError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = 'HttpError' } }
const ADMIN_HEADERS = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }
export function ok<T>(data: T, status = 200) { return new Response(JSON.stringify({ data }), { status, headers: ADMIN_HEADERS }) }
export function fail(error: HttpError) { return new Response(JSON.stringify({ error: { code: error.code, message: error.message } }), { status: error.status, headers: ADMIN_HEADERS }) }
export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) return fail(error)
  if (error instanceof ZodError) return fail(new HttpError(422, 'VALIDATION_ERROR', 'Revise os dados informados.'))
  if (error instanceof SyntaxError) return fail(new HttpError(400, 'INVALID_JSON', 'O corpo da requisição não contém JSON válido.'))
  return fail(new HttpError(500, 'INTERNAL_ERROR', 'Não foi possível concluir esta operação.'))
}
