import { Router } from 'express'
import { authRouter } from '../features/auth/auth.routes.js'
import { invitationRouter } from '../features/invitations/invitation.routes.js'
import { restaurantRouter } from '../features/restaurants/restaurant.routes.js'

export const mobileV1Router = Router()

mobileV1Router.use('/session', authRouter)
mobileV1Router.use('/invites', invitationRouter)
mobileV1Router.use('/restaurants', restaurantRouter)
