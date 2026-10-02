import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { ok } from '../../http/responses.js'
import { scheduleDelivery } from './push.service.js'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

const requireServerKey: RequestHandler = (request, _response, next) => {
  const provided = request.header('x-server-key') ?? ''
  if (!timingSafeEqual(digest(provided), digest(getServerEnv().appServerKey))) {
    next(new HttpError(401, 'SERVER_KEY_INVALID', 'Invalid server key.'))
    return
  }
  next()
}

export const pushRouter = Router()

pushRouter.post('/deliver', requireServerKey, (_request, response) => {
  scheduleDelivery()
  ok(response, { accepted: true }, 202)
})
