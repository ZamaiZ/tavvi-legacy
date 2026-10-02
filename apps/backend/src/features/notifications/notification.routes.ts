import { Router } from 'express'
import { requirePlatformAdmin } from '../../http/auth.middleware.js'
import {
  countNotificationsController,
  listNotificationsController,
  readAllNotificationsController,
  readNotificationController,
  registerDeviceController,
  testNotificationController,
  unregisterDeviceController,
} from './notification.controller.js'

// Central do app do console (território admin).
export const notificationRouter = Router()

notificationRouter.use(requirePlatformAdmin)
notificationRouter.get('/', listNotificationsController)
notificationRouter.get('/count', countNotificationsController)
notificationRouter.post('/read-all', readAllNotificationsController)
notificationRouter.post('/test', testNotificationController)
notificationRouter.post('/devices', registerDeviceController)
notificationRouter.delete('/devices/:token', unregisterDeviceController)
notificationRouter.post('/:id/read', readNotificationController)
