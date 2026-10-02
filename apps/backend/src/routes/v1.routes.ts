import { Router } from 'express'
import { pushRouter } from '../features/push/push.routes.js'

export const v1Router = Router()

// Só servidor (x-server-key), sem sessão: o Next avisa que há push pendente.
v1Router.use('/internal/push', pushRouter)
