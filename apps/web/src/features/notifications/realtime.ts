import { RealtimeClient, REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeSession } from '@/domain/notification'
import { getRealtimeTokenAction } from '@/server/actions/notifications'

// Só o cliente do Realtime vai ao navegador, e só no painel e no console:
// o resto do supabase-js continua no servidor. O token vem de uma ação de
// servidor e é pedido de novo antes de expirar; o navegador nunca usa o
// refresh token.
let session: RealtimeSession | null = null

async function currentSession(): Promise<RealtimeSession | null> {
  if (session && session.expiresAt * 1000 - Date.now() > 60_000) return session
  const result = await getRealtimeTokenAction()
  if (!result.ok) {
    console.error('[notificações] token do tempo real', result.error)
    return null
  }
  session = result.data
  return session
}

type Handlers = {
  onMessage: (event: 'INSERT' | 'UPDATE' | 'DELETE', message: unknown) => void
  /** O canal caiu e voltou: o que chegou no intervalo precisa ser relido. */
  onResync: () => void
  onStatus?: (status: 'connected' | 'disconnected') => void
}

// Devolve a função que fecha o canal. Sem sessão, não abre nada: a central
// continua funcionando pelas ações, só sem o tempo real.
export async function openNotificationsChannel(handlers: Handlers): Promise<() => void> {
  const first = await currentSession()
  if (!first) {
    handlers.onStatus?.('disconnected')
    return () => undefined
  }
  return openPrivateBroadcastChannel(`notifications:${first.territory}:${first.userId}`, ['INSERT', 'UPDATE', 'DELETE'], handlers)
}

export async function openPrivateBroadcastChannel(
  topic: string,
  events: readonly ('INSERT' | 'UPDATE' | 'DELETE')[],
  handlers: Handlers,
  onSubscribed?: () => void,
): Promise<() => void> {
  const first = await currentSession()
  if (!first) {
    handlers.onStatus?.('disconnected')
    return () => undefined
  }

  // O cliente quer o endereço WebSocket, sem o `/websocket` do fim (ele
  // acrescenta). O supabase-js faz a mesma troca de http por ws.
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '').replace(/^http/, 'ws')
  const client = new RealtimeClient(`${base}/realtime/v1`, {
    params: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    // Chamado ao conectar e a cada batimento (25 s). Devolve o token em
    // memória e só vai ao servidor quando faltar menos de um minuto: a
    // permissão do canal acompanha a sessão renovada pelo proxy.
    accessToken: async () => (await currentSession())?.token ?? null,
  })
  await client.setAuth()

  // O tópico tem o território: a mesma conta no console e no painel abre
  // dois canais diferentes, e a política do banco só libera os dela.
  const channel: RealtimeChannel = client.channel(topic, {
    config: { private: true },
  })
  for (const event of events) {
    channel.on('broadcast', { event }, (message) => handlers.onMessage(event, message))
  }

  let subscribedOnce = false
  channel.subscribe((status, error) => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      handlers.onStatus?.('connected')
      if (subscribedOnce) handlers.onResync()
      else onSubscribed?.()
      subscribedOnce = true
      return
    }
    if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
      handlers.onStatus?.('disconnected')
      console.warn('[realtime] canal desconectado', topic, status, error?.message)
    }
    if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) handlers.onStatus?.('disconnected')
  })

  return () => {
    void client.removeChannel(channel)
    void client.disconnect()
  }
}
