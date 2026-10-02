import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import { API_ROUTES, type SignedOut, type UserSummary } from '@tavvi/api-contracts'
import { ApiError, apiRequest, publicApiRequest } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'
import { syncThisDevice, unregisterBeforeSignOut } from '@/features/notifications/push'
import type { AuthContextValue, AuthStatus } from './auth-types'
import type { AvailableBiometric } from './biometric-support'
import { deviceContractStore } from './device-contract-store'
import { useDeviceContractAuth } from './use-device-contract-auth'
import { usePasswordSignIn } from './use-password-sign-in'
import { useSessionBootstrap } from './use-session-bootstrap'

export type { AuthContextValue, AuthStatus } from './auth-types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<UserSummary | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasDeviceContract, setHasDeviceContract] = useState(false)
  const [biometricOffer, setBiometricOffer] = useState<AvailableBiometric | null>(null)
  const dismissMessage = useCallback(() => setMessage(null), [])

  const refreshDeviceContractStatus = useCallback(async () => {
    const metadata = await deviceContractStore.getMetadata()
    setHasDeviceContract(metadata?.registered === true)
  }, [])

  const clearSession = useCallback(async (next: 'signed-out' | 'forbidden', nextMessage: string | null) => {
    await sessionStore.clear()
    queryClient.clear()
    setUser(null)
    setBiometricOffer(null)
    setMessage(nextMessage)
    setStatus(next)
  }, [])

  useSessionBootstrap({ status, setStatus, setUser, setMessage, clearSession, refreshDeviceContractStatus })
  const signIn = usePasswordSignIn({ setStatus, setUser, setMessage, setHasDeviceContract, setBiometricOffer })
  const { signInWithBiometrics, enableBiometrics, disableBiometrics } = useDeviceContractAuth({ setStatus, setUser, setMessage, setHasDeviceContract })

  const dismissBiometricOffer = useCallback(() => setBiometricOffer(null), [])

  // O diálogo fecha antes do pedido de biometria do sistema, para não ficar
  // um Modal por cima do prompt.
  const acceptBiometricOffer = useCallback(async () => {
    setBiometricOffer(null)
    return enableBiometrics()
  }, [enableBiometrics])

  // "Sair": avisa o servidor sem esperar a resposta (offline, sai só
  // localmente). A digital continua. Antes, tira o push deste aparelho da
  // conta (no máximo 3 s, nunca impede sair).
  const signOut = useCallback(async () => {
    await unregisterBeforeSignOut()
    const session = await sessionStore.get().catch(() => null)
    if (session) {
      void publicApiRequest<SignedOut>(API_ROUTES.auth.session, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => undefined)
    }
    await clearSession('signed-out', null)
    await refreshDeviceContractStatus().catch(() => undefined)
  }, [clearSession, refreshDeviceContractStatus])

  // "Sair de todos os aparelhos": este aparelho só é limpo depois que o
  // servidor confirmou. Se as digitais caíram mas as sessões não, a digital
  // local sai e a pessoa continua logada, com a causa na tela.
  // O push sai antes, enquanto a sessão ainda vale; se a saída falhar, a
  // pessoa segue logada e o aparelho volta a receber.
  const signOutEverywhere = useCallback(async () => {
    await unregisterBeforeSignOut()
    try {
      await apiRequest<SignedOut>(API_ROUTES.auth.sessions, { method: 'DELETE' })
    } catch (error) {
      void syncThisDevice({ force: true }).catch(() => undefined)
      if (error instanceof ApiError && error.code === 'SIGN_OUT_EVERYWHERE_INCOMPLETE') {
        await deviceContractStore.deactivate().catch(() => undefined)
        setHasDeviceContract(false)
      }
      throw error
    }
    await deviceContractStore.deactivate().catch(() => undefined)
    setHasDeviceContract(false)
    await clearSession('signed-out', null)
  }, [clearSession])

  const returnToForm = useCallback(() => setStatus('signed-out'), [])
  const value = useMemo(() => ({
    status,
    user,
    message,
    dismissMessage,
    hasDeviceContract,
    biometricOffer,
    signIn,
    signInWithBiometrics,
    acceptBiometricOffer,
    dismissBiometricOffer,
    disableBiometrics,
    signOut,
    signOutEverywhere,
    returnToForm,
  }), [acceptBiometricOffer, biometricOffer, disableBiometrics, dismissBiometricOffer, dismissMessage, hasDeviceContract, message, returnToForm, signIn, signInWithBiometrics, signOut, signOutEverywhere, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
