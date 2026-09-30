import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import type { UserSummary } from '@tavvi/api-contracts'
import { deviceContractStore } from './device-contract-store'
import type { AuthContextValue, AuthStatus } from './auth-types'
import { useDeviceContractAuth } from './use-device-contract-auth'
import { usePasswordSignIn } from './use-password-sign-in'
import { useSessionBootstrap } from './use-session-bootstrap'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'

export type { AuthContextValue, AuthStatus } from './auth-types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<UserSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasDeviceContract, setHasDeviceContract] = useState(false)
  const dismissMessage = useCallback(() => setMessage(null), [])

  const refreshDeviceContractStatus = useCallback(async () => {
    const metadata = await deviceContractStore.getMetadata()
    setHasDeviceContract(metadata?.registered === true)
  }, [])

  const clearSession = useCallback(async (next: 'signed-out' | 'forbidden', nextMessage: string | null) => {
    await sessionStore.clear()
    queryClient.clear()
    setUser(null)
    setMessage(nextMessage)
    setStatus(next)
  }, [])

  useSessionBootstrap({ status, setStatus, setUser, setMessage, clearSession, refreshDeviceContractStatus })
  const signIn = usePasswordSignIn({ setStatus, setUser, setMessage, setHasDeviceContract })
  const { signInWithBiometrics, enableBiometrics, disableBiometrics } = useDeviceContractAuth({
    setStatus,
    setUser,
    setMessage,
    setHasDeviceContract,
    clearSession,
    refreshDeviceContractStatus,
  })

  const signOut = useCallback(async () => {
    await clearSession('signed-out', null)
    await refreshDeviceContractStatus().catch(() => undefined)
  }, [clearSession, refreshDeviceContractStatus])

  const returnToForm = useCallback(() => setStatus('signed-out'), [])
  const value = useMemo(() => ({ status, user, message, dismissMessage, hasDeviceContract, signIn, signInWithBiometrics, enableBiometrics, disableBiometrics, signOut, returnToForm }), [disableBiometrics, dismissMessage, enableBiometrics, hasDeviceContract, message, returnToForm, signIn, signInWithBiometrics, signOut, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
