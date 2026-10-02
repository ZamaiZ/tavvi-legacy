import type { PushSubscriptionInput } from '@/domain/push'
import { deletePushSubscriptionAction } from '@/server/actions/push'

// Escolha da pessoa neste aparelho e nesta origem. Separa "desativei" de
// "a inscrição sumiu sozinha": só a segunda é refeita em silêncio.
const CHOICE_KEY = 'tv-push'

export function readPushChoice(): 'on' | 'off' | null {
  try {
    const value = localStorage.getItem(CHOICE_KEY)
    return value === 'on' || value === 'off' ? value : null
  } catch {
    return null
  }
}

export function writePushChoice(choice: 'on' | 'off'): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice)
  } catch {
    // Modo privado ou dados bloqueados: segue sem lembrar.
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))])
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Inscrição feita com outro par VAPID (chave trocada no servidor) não
// recebe mais nada e precisa ser refeita. Navegador que não informa a chave
// conta como chave atual: refazer às cegas trocaria a inscrição a cada
// abertura do app.
export function usesKey(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const key = subscription.options?.applicationServerKey
  return key ? toBase64Url(key) === vapidPublicKey : true
}

export function serializeSubscription(subscription: PushSubscription): PushSubscriptionInput {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
  }
}

export async function subscribePush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const current = await registration.pushManager.getSubscription()
  if (current && usesKey(current, vapidPublicKey)) return current
  // subscribe() com outra chave lança enquanto a inscrição antiga existir.
  await current?.unsubscribe().catch(() => false)
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
}

async function currentSubscription(): Promise<PushSubscription | null | undefined> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await withTimeout(navigator.serviceWorker.getRegistration('/'), 2000)
  if (!registration || !('pushManager' in registration)) return null
  return withTimeout(registration.pushManager.getSubscription(), 2000)
}

// Sair da conta: este aparelho para de receber os avisos dela, e a próxima
// conta não os herda. Nunca segura a saída por mais de alguns segundos e
// nunca falha.
export async function forgetPushOnThisDevice(): Promise<void> {
  writePushChoice('off')
  try {
    const subscription = await currentSubscription()
    if (!subscription) return
    // Apagar no servidor ainda precisa da sessão: vem antes do signOut.
    await withTimeout(deletePushSubscriptionAction(subscription.endpoint), 3000)
    await subscription.unsubscribe()
  } catch {
    // A saída continua.
  }
}

// Depois de "Sair de todos os aparelhos": o servidor já apagou as inscrições
// da conta; falta só desligar a deste navegador.
export async function unsubscribePushLocally(): Promise<void> {
  writePushChoice('off')
  try {
    const subscription = await currentSubscription()
    await subscription?.unsubscribe()
  } catch {
    // A saída continua.
  }
}
