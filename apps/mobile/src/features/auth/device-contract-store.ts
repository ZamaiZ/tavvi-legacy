import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { z } from 'zod'

const METADATA_KEY = 'tavvi.mobile.device-metadata.v1'
const SECRET_KEY = 'tavvi.mobile.device-secret.v1'
const metadataSchema = z.object({ deviceId: z.string().uuid(), registered: z.boolean() })
const secretSchema = z.string().regex(/^[a-f0-9]{64}$/)
const biometricOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Confirme sua identidade para entrar na Tavvi',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
const webMemory = new Map<string, string>()

function read(key: string, options?: SecureStore.SecureStoreOptions) {
  if (Platform.OS === 'web') return Promise.resolve(webMemory.get(key) ?? null)
  return SecureStore.getItemAsync(key, options)
}

function write(key: string, value: string, options?: SecureStore.SecureStoreOptions) {
  if (Platform.OS === 'web') {
    webMemory.set(key, value)
    return Promise.resolve()
  }
  return SecureStore.setItemAsync(key, value, options)
}

function remove(key: string, options?: SecureStore.SecureStoreOptions) {
  if (Platform.OS === 'web') {
    webMemory.delete(key)
    return Promise.resolve()
  }
  return SecureStore.deleteItemAsync(key, options)
}

async function readMetadata() {
  const raw = await read(METADATA_KEY)
  if (!raw) return null
  try {
    return metadataSchema.parse(JSON.parse(raw))
  } catch {
    await remove(METADATA_KEY)
    return null
  }
}

export const deviceContractStore = {
  async getMetadata(): Promise<{ deviceId: string; registered: boolean } | null> {
    return readMetadata()
  },

  async ensureDeviceId(): Promise<string> {
    const metadata = await readMetadata()
    if (metadata) return metadata.deviceId
    const created = { deviceId: Crypto.randomUUID(), registered: false }
    await write(METADATA_KEY, JSON.stringify(created))
    return created.deviceId
  },

  async getSecret(): Promise<string | null> {
    const raw = await read(SECRET_KEY, biometricOptions)
    if (raw === null) {
      await this.markRegistered(false)
      return null
    }
    const parsed = secretSchema.safeParse(raw)
    if (!parsed.success) {
      await this.clearSecret().catch(() => undefined)
      await this.markRegistered(false)
      return null
    }
    return parsed.data
  },

  async setSecret(secret: string): Promise<void> {
    const value = secretSchema.parse(secret)
    await write(SECRET_KEY, value, biometricOptions)
  },

  async markRegistered(registered: boolean): Promise<void> {
    const deviceId = await this.ensureDeviceId()
    await write(METADATA_KEY, JSON.stringify({ deviceId, registered }))
  },

  async clearSecret(): Promise<void> {
    await remove(SECRET_KEY, biometricOptions)
  },
}
