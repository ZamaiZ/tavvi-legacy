import { randomUUID } from 'node:crypto'
import express, { type Express } from 'express'
import { getServerEnv, type ServerEnv } from './config/env.js'
import { errorHandler, notFoundHandler } from './http/errors.js'
import { healthRouter } from './routes/health.routes.js'
import { v1Router } from './routes/v1.routes.js'

export function createApp(env: ServerEnv = getServerEnv()): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.setHeader('X-Request-ID', randomUUID())
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.use(express.json({ limit: '32kb', type: 'application/json' }))

  app.use(healthRouter)
  app.use('/api/v1', v1Router)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
