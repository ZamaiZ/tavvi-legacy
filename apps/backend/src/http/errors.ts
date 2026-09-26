import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'O recurso solicitado não foi encontrado.'))
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof ZodError) {
    response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Revise os dados informados.' } })
    return
  }
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'O corpo da requisição não contém JSON válido.' } })
    return
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição excede o limite permitido.' } })
    return
  }
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir esta operação.' } })
}
