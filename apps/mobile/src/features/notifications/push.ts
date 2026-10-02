import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { API_ROUTES, type PushPlatform } from '@tavvi/api-contracts'
import { apiRequest } from '@/lib/api-client'

// Push do console neste aparelho. O token salvo aqui marca que a pessoa
// tocou em "Ativar notificações" neste celular: sem ele, nada é registrado
// sozinho, e "Desativar" continua valendo depois de reabrir o app.
const TOKEN_KEY = 'tavvi.push-token'
const storeOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
// Reabrir o app várias vezes seguidas não reenvia o token a cada vez.
const SYNC_INTERVAL_MS = 10 * 60_000

export const ANDROID_CHANNEL_ID = 'default'
export const pushSupported = Platform.OS === 'ios' || Platform.OS === 'android'

export type PushPermission = 'granted' | 'ask' | 'blocked' | 'unsupported'
export type DevicePushState = { permission: PushPermission; enabled: boolean }

// Erro de configuração do push, com a causa exata para a tela.
export class PushSetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushSetupError'
  }
}

let lastSync: { token: string; at: number } | null = null

function readPermission(status: Notifications.NotificationPermissionsStatus): PushPermission {
  if (status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted'
  return status.canAskAgain ? 'ask' : 'blocked'
}

// No Android 13+, o pedido de permissão só aparece depois que existe um
// canal, e o canal precisa existir antes do token (doc do SDK 57).
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Avisos',
    importance: Notifications.AndroidImportance.MAX,
  })
}

function projectId(): string {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (typeof id !== 'string' || !id) throw new PushSetupError('O app está sem o projectId do EAS (extra.eas.projectId no app.json).')
  return id
}

async function expoToken(): Promise<string> {
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: projectId() })
    return result.data
  } catch (error) {
    if (error instanceof PushSetupError) throw error
    const detail = error instanceof Error ? error.message : String(error)
    if (/FirebaseApp|google-services|FCM|Firebase/i.test(detail)) {
      throw new PushSetupError('O push do Android ainda não está configurado: falta o google-services.json do Firebase neste build do app.')
    }
    throw new PushSetupError(`Não foi possível obter o token de push deste aparelho: ${detail}`)
  }
}

async function register(token: string) {
  const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android'
  await apiRequest(API_ROUTES.notifications.devices, { method: 'POST', body: JSON.stringify({ token, platform }) })
  await SecureStore.setItemAsync(TOKEN_KEY, token, storeOptions)
  lastSync = { token, at: Date.now() }
}

export async function readDevicePushState(): Promise<DevicePushState> {
  if (!pushSupported) return { permission: 'unsupported', enabled: false }
  const [status, token] = await Promise.all([Notifications.getPermissionsAsync(), SecureStore.getItemAsync(TOKEN_KEY)])
  const permission = readPermission(status)
  return { permission, enabled: permission === 'granted' && Boolean(token) }
}

// Só no toque em "Ativar notificações": é aqui que o sistema pede a
// permissão, nunca ao abrir o app.
export async function enableOnThisDevice(): Promise<DevicePushState> {
  if (!pushSupported) throw new PushSetupError('As notificações só funcionam no app do celular.')
  await ensureAndroidChannel()
  const current = readPermission(await Notifications.getPermissionsAsync())
  const permission = current === 'granted' ? current : readPermission(await Notifications.requestPermissionsAsync())
  if (permission !== 'granted') {
    throw new PushSetupError(permission === 'blocked'
      ? 'As notificações estão bloqueadas para o Tavvi nos ajustes do celular.'
      : 'Você não permitiu as notificações neste celular.')
  }
  await register(await expoToken())
  return { permission: 'granted', enabled: true }
}

// Tira este aparelho da conta. A permissão do sistema fica como está.
export async function disableOnThisDevice(): Promise<DevicePushState> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) await apiRequest(API_ROUTES.notifications.device(token), { method: 'DELETE' })
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  lastSync = null
  return readDevicePushState()
}

// Ao abrir o app já logado, ao voltar a ele e quando o sistema troca o
// token: reenvia só se a pessoa ativou neste aparelho e a permissão segue
// dada. Nunca pede permissão. Também devolve o aparelho à conta depois de
// um "Sair" (o servidor tinha apagado o token).
export async function syncThisDevice(options: { force?: boolean } = {}): Promise<void> {
  if (!pushSupported) return
  const stored = await SecureStore.getItemAsync(TOKEN_KEY)
  if (!stored) return
  if (!options.force && lastSync?.token === stored && Date.now() - lastSync.at < SYNC_INTERVAL_MS) return
  if (readPermission(await Notifications.getPermissionsAsync()) !== 'granted') return
  await ensureAndroidChannel()
  const token = await expoToken()
  if (token !== stored) {
    await apiRequest(API_ROUTES.notifications.device(stored), { method: 'DELETE' }).catch(() => undefined)
  }
  await register(token)
}

// Antes de sair da conta: o celular deslogado não pode continuar recebendo
// os avisos de quem saiu. Apaga só no servidor (a escolha local fica para
// o próximo login) e nunca impede sair: no máximo 3 s, erro ignorado.
export async function unregisterBeforeSignOut(): Promise<void> {
  if (!pushSupported) return
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) return
  lastSync = null
  await Promise.race([
    apiRequest(API_ROUTES.notifications.device(token), { method: 'DELETE' }).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
}
