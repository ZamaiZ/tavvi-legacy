import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AppState, Platform } from 'react-native'
import type { MobileSession, MobileUser, SessionInfo } from '@/contracts/mobile-api'
import { apiRequest, publicApiRequest, publicEnvReady, registerSessionInvalidator } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'

export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'
export type AuthContextValue = {
  status: AuthStatus
  user: MobileUser | null
  message: string | null
  signIn(input: { email: string; password: string }): Promise<void>
  signOut(): Promise<void>
  returnToForm(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<MobileUser | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const clearSession = useCallback(async (next: 'signed-out' | 'forbidden', nextMessage: string | null) => {
    await sessionStore.clear()
    queryClient.clear()
    setUser(null)
    setMessage(nextMessage)
    setStatus(next)
  }, [])

  const validate = useCallback(async () => {
    const info = await apiRequest<SessionInfo>('/api/mobile/v1/session')
    setUser(info.user)
    setMessage(null)
    setStatus('authenticated')
  }, [])

  useEffect(() => {
    let active = true

    async function initialize() {
      if (!publicEnvReady) {
        if (active) {
          setMessage('Configure EXPO_PUBLIC_API_URL para conectar o app.')
          setStatus('signed-out')
        }
        return
      }

      const stored = await sessionStore.get()
      if (!active) return
      if (!stored) {
        setStatus('signed-out')
        return
      }

      setUser(stored.user)
      try {
        await validate()
      } catch {
        const stillStored = await sessionStore.get()
        if (active && stillStored) {
          setUser(stillStored.user)
          setStatus('authenticated')
        }
      }
    }

    void initialize()
    const unregister = registerSessionInvalidator(async (reason) => {
      await clearSession(
        reason === 'forbidden' ? 'forbidden' : 'signed-out',
        reason === 'forbidden' ? 'Seu acesso administrativo foi removido.' : 'Sua sessão expirou. Entre novamente.',
      )
    })
    return () => { active = false; unregister() }
  }, [clearSession, validate])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'authenticated') void validate().catch(() => undefined)
    })
    return () => listener.remove()
  }, [status, validate])

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const session = await publicApiRequest<MobileSession>('/api/mobile/v1/session', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    try {
      await sessionStore.set(session)
    } catch {
      await publicApiRequest('/api/mobile/v1/session', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => undefined)
      throw new Error('Não foi possível salvar a sessão neste aparelho.')
    }
    queryClient.clear()
    setUser(session.user)
    setMessage(null)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    if (await sessionStore.get()) {
      await apiRequest<{ signedOut: true }>('/api/mobile/v1/session', { method: 'DELETE' }).catch(() => undefined)
    }
    await clearSession('signed-out', null)
  }, [clearSession])

  const returnToForm = useCallback(() => setStatus('signed-out'), [])
  const value = useMemo(() => ({ status, user, message, signIn, signOut, returnToForm }), [message, returnToForm, signIn, signOut, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
