import 'server-only'
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import type { PushMessage } from '@/domain/push'
import { env } from '@/server/env'

export type PushTarget = { endpoint: string; p256dh: string; auth: string }

export type PushDelivery = { targets: PushTarget[]; message: PushMessage }

// Um aviso que chega um dia depois já não serve: o serviço de push o
// descarta se o aparelho ficar fora do ar por mais tempo que isso.
const TTL_SECONDS = 60 * 60 * 24

let configured = false

function configure() {
  if (configured) return
  setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  configured = true
}

// Entrega a cada aparelho. Um que falha não derruba os outros. Devolve
// quantos receberam e os endpoints que o serviço deu como mortos (404 e
// 410: desinstalou, limpou os dados, revogou), para a DAL apagar.
export async function sendWebPush(delivery: PushDelivery): Promise<{ delivered: number; gone: string[] }> {
  configure()
  const payload = JSON.stringify(delivery.message)
  const results = await Promise.allSettled(
    delivery.targets.map((target) =>
      sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: TTL_SECONDS, urgency: 'normal', timeout: 10_000 },
      ),
    ),
  )

  let delivered = 0
  const gone: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      delivered += 1
      return
    }
    const status = result.reason instanceof WebPushError ? result.reason.statusCode : undefined
    if (status === 404 || status === 410) gone.push(delivery.targets[index].endpoint)
    else console.error('[push] não entregue', { status })
  })
  return { delivered, gone }
}
