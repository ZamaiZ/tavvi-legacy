import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/healthz', (_request, response) => {
  response.status(200).json({ status: 'ok' })
})
