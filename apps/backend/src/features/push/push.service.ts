import { getServerEnv } from '../../config/env.js'
import { createAnonymousSupabaseClient } from '../../integrations/supabase/client.js'
import { sendWebPush, type WebPushMessage, type WebPushTarget } from './web-push.js'

const PRUNE_CHUNK = 100

type WebDelivery = { message: WebPushMessage; targets: WebPushTarget[] }

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let start = 0; start < values.length; start += size) result.push(values.slice(start, start + size))
  return result
}

// Claim recent notifications once and deliver them to browser subscriptions
// in the notification territory. The database validates the server key.
export async function deliverPendingPushes(): Promise<void> {
  const env = getServerEnv()
  const supabase = createAnonymousSupabaseClient()
  const { data, error } = await supabase.rpc('claim_notification_pushes', { p_key: env.appServerKey })
  if (error) {
    console.error('[push] claim failed', error.code, error.message)
    return
  }

  const web = new Map<string, WebDelivery>()
  for (const row of data ?? []) {
    if (!row.endpoint || !row.p256dh || !row.auth) continue
    const delivery = web.get(row.notification_id) ?? {
      message: { title: row.title, body: row.body, url: row.url, tag: row.notification_id },
      targets: [],
    }
    delivery.targets.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })
    web.set(row.notification_id, delivery)
  }
  if (!web.size) return

  const results = await Promise.all([...web.values()].map((delivery) => sendWebPush(delivery.message, delivery.targets)))
  for (const endpoints of chunks(results.flatMap((result) => result.gone), PRUNE_CHUNK)) {
    const { error: pruneError } = await supabase.rpc('server_prune_push_subscriptions', {
      p_key: env.appServerKey,
      p_endpoints: endpoints,
    })
    if (pruneError) console.error('[push] browser subscription pruning failed', pruneError.code, pruneError.message)
  }
}

export function scheduleDelivery(): void {
  setImmediate(() => {
    deliverPendingPushes().catch((error) => {
      console.error('[push] delivery failed', error instanceof Error ? error.message : error)
    })
  })
}
