import { REALTIME_SUBSCRIBE_STATES, RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js'

type PublicCallHandlers = {
  onMessage: (message: unknown) => void
  onSubscribed: () => void
  onResync: () => void
  onStatus?: (status: 'connected' | 'disconnected') => void
}

export async function openPublicServiceCallChannel(token: string, handlers: PublicCallHandlers): Promise<() => void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    handlers.onStatus?.('disconnected')
    return () => undefined
  }

  const base = supabaseUrl.replace(/\/+$/, '').replace(/^http/, 'ws')
  const client = new RealtimeClient(`${base}/realtime/v1`, { params: { apikey: anonKey } })
  await client.setAuth(anonKey)
  const channel: RealtimeChannel = client.channel(`service_calls_guest:${token}`, {
    config: { private: true },
  })
  channel.on('broadcast', { event: 'service_call_status' }, (message) => handlers.onMessage(message))

  let subscribedOnce = false
  channel.subscribe((status, error) => {
    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      handlers.onStatus?.('connected')
      if (subscribedOnce) handlers.onResync()
      else handlers.onSubscribed()
      subscribedOnce = true
      return
    }
    if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR || status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
      handlers.onStatus?.('disconnected')
      console.warn('[realtime] canal público desconectado', status, error?.message)
    }
    if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) handlers.onStatus?.('disconnected')
  })

  return () => {
    void client.removeChannel(channel)
    void client.disconnect()
  }
}
