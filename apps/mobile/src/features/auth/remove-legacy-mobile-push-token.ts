import * as SecureStore from 'expo-secure-store'
import { API_ROUTES } from '@tavvi/api-contracts'
import { apiRequest } from '@/lib/api-client'

const TOKEN_KEY = 'tavvi.push-token'

// Old builds may have registered this phone for Expo push. Remove that
// registration while the account is authenticated, without importing the
// native notifications package that Expo Go does not support.
export async function removeLegacyMobilePushToken(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) return

  const unregister = apiRequest(API_ROUTES.notifications.device(token), { method: 'DELETE' })
    .then(() => SecureStore.deleteItemAsync(TOKEN_KEY))
    .catch(() => undefined)

  await Promise.race([
    unregister,
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ])
}
