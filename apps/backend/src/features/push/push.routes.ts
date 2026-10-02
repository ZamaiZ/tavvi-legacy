import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import { getServerEnv } from '../../config/env.js'
import { HttpError } from '../../http/errors.js'
import { ok } from '../../http/responses.js'
import { scheduleDelivery } from './push.service.js'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

// Só servidor: o Next chama depois de cada ação que dispara notificação. A
// chave é a mesma APP_SERVER_KEY que o banco confere na reivindicação.
// Comparar os hashes deixa os dois lados com o mesmo tamanho, como o
// timingSafeEqual exige.
const requireServerKey: RequestHandler = (request, _response, next) => {
  const provided = request.header('x-server-key') ?? ''
  if (!timingSafeEqual(digest(provided), digest(getServerEnv().appServerKey))) {
    next(new HttpError(401, 'SERVER_KEY_INVALID', 'Chave de servidor inválida.'))
    return
  }
  next()
}

export const pushRouter = Router()

// Responde na hora e entrega depois: quem chamou não espera o Expo nem os
// serviços de Web Push.
pushRouter.post('/deliver', requireServerKey, (_request, response) => {
  scheduleDelivery()
  ok(response, { accepted: true }, 202)
})
