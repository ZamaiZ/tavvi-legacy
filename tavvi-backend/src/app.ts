import { randomUUID } from 'node:crypto'
import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import { getServerEnv, type ServerEnv } from './config/env.js'
import { errorHandler, notFoundHandler } from './http/errors.js'
import { healthRouter } from './routes/health.routes.js'
import { mobileV1Router } from './routes/mobile-v1.routes.js'

export function createApp(env: ServerEnv = getServerEnv()): Express {
  const app = express()
  app.disable('x-powered-by')
  if (env.trustedProxies.length) app.set('trust proxy', env.trustedProxies)

  app.use((_request, response, next) => {
    response.setHeader('X-Request-ID', randomUUID())
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.use(express.json({ limit: '32kb', type: 'application/json' }))

  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.get('origin')
    if (origin && env.corsOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(origin && env.corsOrigins.includes(origin) ? 204 : 403)
      return
    }
    next()
  })

  app.use(healthRouter)
  app.use('/api/mobile/v1', mobileV1Router)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
