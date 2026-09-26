import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const CHUNK_SIZE = 1800
type Bank = 'a' | 'b'
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const partKey = (key: string, bank: Bank, suffix: string | number) => `${key}.${bank}.${suffix}`
const webMemory = new Map<string, string>()
const read = (key: string) => Platform.OS === 'web' ? Promise.resolve(webMemory.get(key) ?? null) : SecureStore.getItemAsync(key)
const write = (key: string, value: string) => { if (Platform.OS === 'web') { webMemory.set(key, value); return Promise.resolve() }; return SecureStore.setItemAsync(key, value, options) }
const erase = (key: string) => { if (Platform.OS === 'web') { webMemory.delete(key); return Promise.resolve() }; return SecureStore.deleteItemAsync(key) }

async function removeBank(key: string, bank: Bank, count?: number) {
  const storedMeta = count === undefined ? await read(partKey(key, bank, 'meta')) : null
  const parsedCount = count ?? (storedMeta && /^\d+$/.test(storedMeta) ? Number(storedMeta) : 0)
  await Promise.all(Array.from({ length: parsedCount }, (_, index) => erase(partKey(key, bank, index))))
  await erase(partKey(key, bank, 'meta'))
}

export const secureStoreAdapter = {
  async getItem(key: string) {
    const pointer = await read(`${key}.pointer`) as Bank | null
    if (pointer !== 'a' && pointer !== 'b') return null
    const meta = await read(partKey(key, pointer, 'meta'))
    if (!meta || !/^\d+$/.test(meta)) { await this.removeItem(key); return null }
    const count = Number(meta)
    if (!Number.isSafeInteger(count) || count < 1) { await this.removeItem(key); return null }
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => read(partKey(key, pointer, index))))
    if (chunks.some((chunk) => chunk === null)) { await this.removeItem(key); return null }
    return chunks.join('')
  },
  async setItem(key: string, value: string) {
    const pointer = await read(`${key}.pointer`) as Bank | null
    const next: Bank = pointer === 'a' ? 'b' : 'a'
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? ['']
    await removeBank(key, next)
    await Promise.all(chunks.map((chunk, index) => write(partKey(key, next, index), chunk)))
    await write(partKey(key, next, 'meta'), String(chunks.length))
    await write(`${key}.pointer`, next)
    if (pointer === 'a' || pointer === 'b') await removeBank(key, pointer)
  },
  async removeItem(key: string) {
    await Promise.all([removeBank(key, 'a'), removeBank(key, 'b')])
    await erase(`${key}.pointer`)
  },
}
