import { getServerEnv } from '../../config/env.js'

// Expo Push Service: https://docs.expo.dev/push-notifications/sending-notifications/
const SEND_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

export type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data: { notificationId: string; kind: string; url: string; restaurantId: string | null }
  sound: 'default'
  channelId: 'default'
  priority: 'high'
}

type Ticket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } }

async function post(messages: ExpoPushMessage[]): Promise<Response | null> {
  const { expoAccessToken } = getServerEnv()
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' }
  if (expoAccessToken) headers.authorization = `Bearer ${expoAccessToken}`
  try {
    return await fetch(SEND_URL, { method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    console.error('[push] expo: sem resposta', error instanceof Error ? error.message : error)
    return null
  }
}

// Rede, 429 e 5xx: uma nova tentativa depois de 1 s (a doc pede backoff;
// mais que isso atrasaria a entrega das próximas sem ganho real). 400 é
// mensagem malformada e repetir não resolve.
async function sendBatch(messages: ExpoPushMessage[]): Promise<string[]> {
  let response = await post(messages)
  if (!response || response.status === 429 || response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    response = await post(messages)
  }
  if (!response) return []
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[push] expo: envio recusado', { status: response.status, detail: detail.slice(0, 300) })
    return []
  }

  const body = (await response.json().catch(() => null)) as { data?: Ticket[] } | null
  const tickets = body && Array.isArray(body.data) ? body.data : []
  const gone: string[] = []
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'ok') return
    const code = ticket.details?.error ?? null
    // DeviceNotRegistered: o app saiu do aparelho ou o token caducou. Os
    // outros erros (credencial FCM/APNs, mensagem grande) vão para o log.
    if (code === 'DeviceNotRegistered') gone.push(messages[index]!.to)
    else console.error('[push] expo: ticket com erro', { code, message: ticket.message ?? null })
  })
  return gone
}

// Envia em lotes de 100 (limite da API) e devolve os tokens mortos. Nunca
// lança: falha de envio é log, não erro de quem disparou a notificação.
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ gone: string[] }> {
  const gone: string[] = []
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    gone.push(...(await sendBatch(messages.slice(start, start + BATCH_SIZE))))
  }
  return { gone }
}
