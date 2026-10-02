import { Router } from 'express'
import { authRouter } from '../features/auth/auth.routes.js'
import { invitationRouter } from '../features/invitations/invitation.routes.js'
import { notificationRouter } from '../features/notifications/notification.routes.js'
import { pushRouter } from '../features/push/push.routes.js'
import { restaurantRouter } from '../features/restaurants/restaurant.routes.js'

export const v1Router = Router()

v1Router.use('/auth', authRouter)
v1Router.use('/platform/invitations', invitationRouter)
v1Router.use('/platform/restaurants', restaurantRouter)
v1Router.use('/notifications', notificationRouter)
// Só servidor (x-server-key), sem sessão: o Next avisa que há push pendente.
v1Router.use('/internal/push', pushRouter)
