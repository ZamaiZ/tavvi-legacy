import { getServerEnv } from '../../config/env.js'
import { createAnonymousSupabaseClient } from '../../integrations/supabase/client.js'
import { sendExpoPush, type ExpoPushMessage } from './expo-push.js'
import { sendWebPush, type WebPushMessage, type WebPushTarget } from './web-push.js'

const PRUNE_CHUNK = 100

type WebDelivery = { message: WebPushMessage; targets: WebPushTarget[] }

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let start = 0; start < values.length; start += size) result.push(values.slice(start, start + size))
  return result
}

// Reivindica UMA vez as notificações recentes ainda sem push e entrega em
// cada aparelho do destinatário, no território da notificação: navegadores
// (Web Push) e o app do console (Expo). Sem sessão: quem autoriza é a chave
// do servidor, conferida pelo banco. Nunca lança; tudo vai para o log.
export async function deliverPendingPushes(): Promise<void> {
  const env = getServerEnv()
  const supabase = createAnonymousSupabaseClient()
  const { data, error } = await supabase.rpc('claim_notification_pushes', { p_key: env.appServerKey })
  if (error) {
    console.error('[push] reivindicação falhou', error.code, error.message)
    return
  }

  const web = new Map<string, WebDelivery>()
  const expo: ExpoPushMessage[] = []
  // O canal sai dos campos preenchidos, não da coluna channel: com o banco
  // ainda sem o 0033, a reivindicação antiga (só web) continua entregando.
  for (const row of data ?? []) {
    if (row.endpoint && row.p256dh && row.auth) {
      const delivery = web.get(row.notification_id) ?? {
        message: { title: row.title, body: row.body, url: row.url, tag: row.notification_id },
        targets: [],
      }
      delivery.targets.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })
      web.set(row.notification_id, delivery)
    } else if (row.expo_token) {
      expo.push({
        to: row.expo_token,
        title: row.title,
        body: row.body,
        data: { notificationId: row.notification_id, kind: row.kind, url: row.url, restaurantId: row.restaurant_id },
        sound: 'default',
        channelId: 'default',
        priority: 'high',
      })
    }
  }
  if (!web.size && !expo.length) return

  const [webResults, expoResult] = await Promise.all([
    Promise.all([...web.values()].map((delivery) => sendWebPush(delivery.message, delivery.targets))),
    expo.length ? sendExpoPush(expo) : Promise.resolve({ gone: [] as string[] }),
  ])

  for (const endpoints of chunks(webResults.flatMap((result) => result.gone), PRUNE_CHUNK)) {
    const { error: pruneError } = await supabase.rpc('server_prune_push_subscriptions', { p_key: env.appServerKey, p_endpoints: endpoints })
    if (pruneError) console.error('[push] poda web falhou', pruneError.code, pruneError.message)
  }
  for (const tokens of chunks(expoResult.gone, PRUNE_CHUNK)) {
    const { error: pruneError } = await supabase.rpc('server_prune_mobile_push_tokens', { p_key: env.appServerKey, p_tokens: tokens })
    if (pruneError) console.error('[push] poda expo falhou', pruneError.code, pruneError.message)
  }
}

// Fora do ciclo da requisição: quem chamou já recebeu a resposta.
export function scheduleDelivery() {
  setImmediate(() => {
    deliverPendingPushes().catch((error) => {
      console.error('[push] entrega falhou', error instanceof Error ? error.message : error)
    })
  })
}
