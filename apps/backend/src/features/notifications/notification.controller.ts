import type { RequestHandler } from 'express'
import { ok } from '../../http/responses.js'
import { requireAdminContext } from '../../http/request-context.js'
import { parseCursor } from './notification.schemas.js'
import { countUnread, listUnread, markAllRead, markRead, registerDevice, sendTest, unregisterDevice } from './notification.service.js'

export const listNotificationsController: RequestHandler = async (request, response, next) => {
  try { ok(response, await listUnread(requireAdminContext(request), parseCursor(request.query))) }
  catch (error) { next(error) }
}

export const countNotificationsController: RequestHandler = async (request, response, next) => {
  try { ok(response, await countUnread(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const readNotificationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await markRead(requireAdminContext(request), String(request.params.id ?? ''))) }
  catch (error) { next(error) }
}

export const readAllNotificationsController: RequestHandler = async (request, response, next) => {
  try { ok(response, await markAllRead(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const testNotificationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await sendTest(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const registerDeviceController: RequestHandler = async (request, response, next) => {
  try { ok(response, await registerDevice(requireAdminContext(request), request.body), 201) }
  catch (error) { next(error) }
}

export const unregisterDeviceController: RequestHandler = async (request, response, next) => {
  try { ok(response, await unregisterDevice(requireAdminContext(request), String(request.params.token ?? ''))) }
  catch (error) { next(error) }
}
