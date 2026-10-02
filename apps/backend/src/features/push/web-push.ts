// web-push é CommonJS: o import padrão traz o module.exports inteiro.
import webPush from 'web-push'
import { getServerEnv } from '../../config/env.js'

// O mesmo formato que o service worker do web lê (apps/web/src/domain/push.ts).
export type WebPushMessage = { title: string; body: string; url: string; tag: string }
export type WebPushTarget = { endpoint: string; p256dh: string; auth: string }

// Um aviso que chega um dia depois já não serve: o serviço de push o
// descarta se o aparelho ficar fora do ar por mais tempo que isso.
const TTL_SECONDS = 60 * 60 * 24

let configured = false

function configure() {
  if (configured) return
  const { vapid } = getServerEnv()
  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  configured = true
}

// Entrega a cada navegador. Um que falha não derruba os outros. Devolve os
// endpoints que o serviço deu como mortos (404 e 410: desinstalou, limpou
// os dados, revogou), para apagar.
export async function sendWebPush(message: WebPushMessage, targets: WebPushTarget[]): Promise<{ gone: string[] }> {
  configure()
  const payload = JSON.stringify(message)
  const results = await Promise.allSettled(
    targets.map((target) =>
      webPush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: TTL_SECONDS, urgency: 'normal', timeout: 10_000 },
      ),
    ),
  )

  const gone: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return
    const status = result.reason instanceof webPush.WebPushError ? result.reason.statusCode : undefined
    if (status === 404 || status === 410) gone.push(targets[index]!.endpoint)
    else console.error('[push] web não entregue', { status: status ?? null })
  })
  return { gone }
}
