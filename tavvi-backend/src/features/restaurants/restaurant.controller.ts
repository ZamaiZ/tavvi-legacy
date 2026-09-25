import type { RequestHandler } from 'express'
import { ok } from '../../http/responses.js'
import { requireAdminContext } from '../../http/request-context.js'
import { getRestaurant, listRestaurants } from './restaurant.service.js'

export const listRestaurantsController: RequestHandler = async (request, response, next) => {
  try { ok(response, await listRestaurants(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const getRestaurantController: RequestHandler = async (request, response, next) => {
  try { ok(response, await getRestaurant(requireAdminContext(request), request.params.id ?? '')) }
  catch (error) { next(error) }
}
