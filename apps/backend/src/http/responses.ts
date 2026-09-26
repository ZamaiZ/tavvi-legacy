import type { Response } from 'express'

export function ok<T>(response: Response, data: T, status = 200) {
  response.status(status).json({ data })
}
