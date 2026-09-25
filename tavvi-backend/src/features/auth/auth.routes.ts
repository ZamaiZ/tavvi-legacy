import { Router } from 'express'
import { requireAuthenticatedUser, requirePlatformAdmin } from '../../http/auth.middleware.js'
import { getSessionController, refreshController, signInController, signOutController } from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/', signInController)
authRouter.post('/refresh', refreshController)
authRouter.get('/', requirePlatformAdmin, getSessionController)
authRouter.delete('/', requireAuthenticatedUser, signOutController)
