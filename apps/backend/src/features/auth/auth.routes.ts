import { Router } from 'express'
import { requireAuthenticatedUser, requirePlatformAdmin } from '../../http/auth.middleware.js'
import {
  deviceContractLoginController,
  deviceContractStatusController,
  getSessionController,
  refreshController,
  registerDeviceContractController,
  revokeDeviceContractController,
  signInController,
  signOutController,
  signOutEverywhereController,
} from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/login', signInController)
authRouter.post('/refresh', refreshController)
authRouter.post('/device-contract/login', deviceContractLoginController)
authRouter.post('/device-contract', requirePlatformAdmin, registerDeviceContractController)
authRouter.get('/device-contract/:deviceId', requireAuthenticatedUser, deviceContractStatusController)
authRouter.delete('/device-contract', revokeDeviceContractController)
authRouter.get('/session', requirePlatformAdmin, getSessionController)
authRouter.delete('/session', requireAuthenticatedUser, signOutController)
authRouter.delete('/sessions', requireAuthenticatedUser, signOutEverywhereController)
