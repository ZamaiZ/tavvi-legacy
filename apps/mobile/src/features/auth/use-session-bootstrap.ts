import { useCallback, useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { API_ROUTES, type SessionSnapshot } from '@tavvi/api-contracts'
import { apiRequest, publicEnvReady, registerSessionInvalidator } from '@/lib/api-client'
import { sessionStore } from '@/lib/session-store'
import type { AuthStateSetters, AuthStatus } from './auth-types'

type UseSessionBootstrapInput = AuthStateSetters & {
  status: AuthStatus
  clearSession(next: 'signed-out' | 'forbidden', nextMessage: string | null): Promise<void>
  refreshDeviceContractStatus(): Promise<void>
}

export function useSessionBootstrap({ status, setStatus, setUser, setMessage, clearSession, refreshDeviceContractStatus }: UseSessionBootstrapInput) {
  const validate = useCallback(async () => {
    const info = await apiRequest<SessionSnapshot>(API_ROUTES.auth.session)
    setUser(info.user)
    setMessage(null)
    setStatus('authenticated')
  }, [setMessage, setStatus, setUser])

  useEffect(() => {
    let active = true

    async function initialize() {
      await refreshDeviceContractStatus().catch(() => undefined)
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
  }, [clearSession, refreshDeviceContractStatus, setMessage, setStatus, setUser, validate])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'authenticated') void validate().catch(() => undefined)
    })
    return () => listener.remove()
  }, [status, validate])
}
