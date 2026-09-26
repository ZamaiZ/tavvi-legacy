import { z } from 'zod'
import type { AuthSession } from '@tavvi/api-contracts'
import { secureStoreAdapter } from './secure-store-adapter'

const SESSION_KEY = 'tavvi.mobile.session.v1'
const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  expiresIn: z.number(),
  tokenType: z.literal('bearer'),
  user: z.object({ id: z.string().uuid(), email: z.string().email() }),
}) satisfies z.ZodType<AuthSession>

let writes: Promise<unknown> = Promise.resolve()

function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = writes.then(operation, operation)
  writes = result.then(() => undefined, () => undefined)
  return result
}

async function readSession(): Promise<AuthSession | null> {
  const raw = await secureStoreAdapter.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return sessionSchema.parse(JSON.parse(raw))
  } catch {
    await secureStoreAdapter.removeItem(SESSION_KEY)
    return null
  }
}

export const sessionStore = {
  async get(): Promise<AuthSession | null> {
    return exclusive(readSession)
  },
  async set(session: AuthSession): Promise<void> {
    await exclusive(() => secureStoreAdapter.setItem(SESSION_KEY, JSON.stringify(session)))
  },
  async clear(): Promise<void> {
    await exclusive(() => secureStoreAdapter.removeItem(SESSION_KEY))
  },
  async replaceIfRefreshToken(expectedRefreshToken: string, session: AuthSession): Promise<boolean> {
    return exclusive(async () => {
      const current = await readSession()
      if (current?.refreshToken !== expectedRefreshToken) return false
      await secureStoreAdapter.setItem(SESSION_KEY, JSON.stringify(session))
      return true
    })
  },
  async clearIfRefreshToken(expectedRefreshToken: string): Promise<boolean> {
    return exclusive(async () => {
      const current = await readSession()
      if (current?.refreshToken !== expectedRefreshToken) return false
      await secureStoreAdapter.removeItem(SESSION_KEY)
      return true
    })
  },
}
