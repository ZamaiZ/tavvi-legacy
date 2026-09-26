import { Router } from 'express'
import { requirePlatformAdmin } from '../../http/auth.middleware.js'
import { getRestaurantController, listRestaurantsController } from './restaurant.controller.js'

export const restaurantRouter = Router()

restaurantRouter.use(requirePlatformAdmin)
restaurantRouter.get('/', listRestaurantsController)
restaurantRouter.get('/:id', getRestaurantController)
