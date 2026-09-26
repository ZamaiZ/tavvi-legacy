import { Router } from 'express'
import { requirePlatformAdmin } from '../../http/auth.middleware.js'
import { getPlatformAppearanceController, updatePlatformAppearanceController } from './appearance.controller.js'

export const appearanceRouter = Router()

appearanceRouter.get('/', getPlatformAppearanceController)
appearanceRouter.patch('/', requirePlatformAdmin, updatePlatformAppearanceController)
