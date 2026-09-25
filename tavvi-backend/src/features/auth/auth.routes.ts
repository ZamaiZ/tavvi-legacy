import { Router } from 'express'
import { requireAuthenticatedUser, requirePlatformAdmin } from '../../http/auth.middleware.js'
import { deviceContractLoginController, getSessionController, refreshController, registerDeviceContractController, revokeDeviceContractController, signInController, signOutController } from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/', signInController)
authRouter.post('/refresh', refreshController)
authRouter.post('/device', deviceContractLoginController)
authRouter.post('/device-contract', requireAuthenticatedUser, registerDeviceContractController)
authRouter.delete('/device-contract', revokeDeviceContractController)
authRouter.get('/', requirePlatformAdmin, getSessionController)
authRouter.delete('/', requireAuthenticatedUser, signOutController)
