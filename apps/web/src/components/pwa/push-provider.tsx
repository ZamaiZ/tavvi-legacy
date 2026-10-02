'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { deletePushSubscriptionAction, savePushSubscriptionAction } from '@/server/actions/push'
import { detectPlatform } from './platform'
import { readPushChoice, serializeSubscription, subscribePush, usesKey, withTimeout, writePushChoice } from './push-client'

// unsupported: navegador sem Web Push; a linha "Notificações" some.
// needs-install: iPhone ou iPad fora do app instalado. O iOS só entrega push
// ao app da Tela de Início.
// default | denied | granted: Notification.permission.
export type PushAvailability = 'unsupported' | 'needs-install' | NotificationPermission

// error vazio: nada a dizer (toque repetido, ou a pessoa fechou o pedido de
// permissão sem escolher).
export type PushResult = { ok: true } | { ok: false; error: string }

type PushContextValue = {
  availability: PushAvailability
  subscribed: boolean
  pending: boolean
  enable: () => Promise<PushResult>
  disable: () => Promise<PushResult>
}

const PushContext = createContext<PushContextValue | null>(null)

const SW_TIMEOUT_MS = 10_000
const LOADING_ERROR = 'O app ainda está carregando. Tente de novo em instantes.'

function supportsPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function PushProvider({
  vapidPublicKey,
  isInstalled,
  children,
}: {
  vapidPublicKey: string
  isInstalled: boolean
  children: React.ReactNode
}) {
  // "unsupported" no servidor e no primeiro render, para o HTML dos dois
  // lados coincidir. O efeito lê o navegador.
  const [availability, setAvailability] = useState<PushAvailability>('unsupported')
  const [subscribed, setSubscribed] = useState(false)
  const [pending, setPending] = useState(false)
  // Dois toques rápidos fariam dois pedidos.
  const busy = useRef(false)

  useEffect(() => {
    if (!supportsPush()) {
      setAvailability(detectPlatform() === 'ios' && !isInstalled ? 'needs-install' : 'unsupported')
      return
    }
    setAvailability(Notification.permission)
    let cancelled = false

    // Ao abrir, aparelho e servidor voltam a concordar: sobra de quem
    // desativou sai; chave VAPID trocada, ou inscrição perdida de quem
    // ativou, é refeita; a inscrição válida é regravada (o servidor pode
    // tê-la podado, ou outra conta pode ter usado este navegador).
    void (async () => {
      const registration = await withTimeout(navigator.serviceWorker.ready, SW_TIMEOUT_MS)
      if (!registration || cancelled) return
      const granted = Notification.permission === 'granted'
      const choice = readPushChoice()
      let subscription = await registration.pushManager.getSubscription()
      if (subscription && (!granted || choice === 'off')) {
        await subscription.unsubscribe().catch(() => false)
        subscription = null
      } else if (granted && choice !== 'off' && (subscription ? !usesKey(subscription, vapidPublicKey) : choice === 'on')) {
        subscription = await subscribePush(registration, vapidPublicKey)
      }
      if (cancelled) return
      setSubscribed(Boolean(subscription))
      if (subscription) await savePushSubscriptionAction(serializeSubscription(subscription))
    })().catch(() => undefined)

    // A permissão também muda nas configurações do navegador, com o app aberto.
    let status: PermissionStatus | null = null
    const onPermission = () => {
      setAvailability(Notification.permission)
      if (Notification.permission !== 'granted') setSubscribed(false)
    }
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        if (cancelled) return
        status = result
        result.addEventListener('change', onPermission)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      status?.removeEventListener('change', onPermission)
    }
  }, [isInstalled, vapidPublicKey])

  const value = useMemo<PushContextValue>(() => {
    async function guard(task: () => Promise<PushResult>, failure: string): Promise<PushResult> {
      busy.current = true
      setPending(true)
      try {
        return await task()
      } catch {
        return { ok: false, error: failure }
      } finally {
        busy.current = false
        setPending(false)
      }
    }

    function enable(): Promise<PushResult> {
      if (busy.current) return Promise.resolve({ ok: false, error: '' })
      // Sai do toque, antes de qualquer await: o Safari recusa o pedido de
      // permissão feito fora do gesto.
      const permission = Notification.requestPermission()
      return guard(async () => {
        const result = await permission
        setAvailability(result)
        if (result !== 'granted') {
          return {
            ok: false,
            error: result === 'denied' ? 'As notificações estão bloqueadas. Libere nas configurações do navegador.' : '',
          }
        }
        const registration = await withTimeout(navigator.serviceWorker.ready, SW_TIMEOUT_MS)
        if (!registration) return { ok: false, error: LOADING_ERROR }
        const subscription = await subscribePush(registration, vapidPublicKey)
        const saved = await savePushSubscriptionAction(serializeSubscription(subscription))
        if (!saved.ok) {
          // Sem a linha no servidor, a inscrição não serviria para nada.
          await subscription.unsubscribe().catch(() => false)
          return saved
        }
        writePushChoice('on')
        setSubscribed(true)
        return { ok: true }
      }, 'Não foi possível ativar as notificações neste aparelho.')
    }

    function disable(): Promise<PushResult> {
      if (busy.current) return Promise.resolve({ ok: false, error: '' })
      return guard(async () => {
        const registration = await withTimeout(navigator.serviceWorker.ready, SW_TIMEOUT_MS)
        if (!registration) return { ok: false, error: LOADING_ERROR }
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const removed = await deletePushSubscriptionAction(subscription.endpoint)
          if (!removed.ok) return removed
          await subscription.unsubscribe().catch(() => false)
        }
        writePushChoice('off')
        setSubscribed(false)
        return { ok: true }
      }, 'Não foi possível desativar as notificações neste aparelho.')
    }

    return { availability, subscribed, pending, enable, disable }
  }, [availability, subscribed, pending, vapidPublicKey])

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>
}

export function usePush() {
  const value = useContext(PushContext)
  if (!value) throw new Error('usePush precisa estar dentro de PwaProvider')
  return value
}
