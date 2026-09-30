import { Router } from 'express'
import { authRouter } from '../features/auth/auth.routes.js'
import { invitationRouter } from '../features/invitations/invitation.routes.js'
import { restaurantRouter } from '../features/restaurants/restaurant.routes.js'

export const v1Router = Router()

v1Router.use('/auth', authRouter)
v1Router.use('/platform/invitations', invitationRouter)
v1Router.use('/platform/restaurants', restaurantRouter)
