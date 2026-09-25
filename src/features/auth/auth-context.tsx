import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import * as Crypto from 'expo-crypto'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Alert, AppState, Platform } from 'react-native'
import type { DeviceContractLoginInput, DeviceContractRegistrationInput, MobileSession, MobileUser, SessionInfo } from '@/contracts/mobile-api'
import { apiRequest, ApiError, publicApiRequest, publicEnvReady, registerSessionInvalidator } from '@/lib/api-client'
import { deviceContractStore } from '@/lib/device-contract-store'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'

export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'
export type AuthContextValue = {
  status: AuthStatus
  user: MobileUser | null
  message: string | null
  hasDeviceContract: boolean
  signIn(input: { email: string; password: string }): Promise<void>
  signInWithBiometrics(): Promise<void>
  disableBiometrics(): Promise<void>
  signOut(): Promise<void>
  returnToForm(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function canEnrollBiometrics() {
  if (Platform.OS === 'web') return false
  const [hardware, enrolled, secureStoreReady] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.canUseBiometricAuthentication(),
  ])
  return hardware && enrolled && secureStoreReady
}

async function refreshPasswordSession(credentials: { email: string; password: string }) {
  return publicApiRequest<MobileSession>('/api/mobile/v1/session', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<MobileUser | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasDeviceContract, setHasDeviceContract] = useState(false)

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

  const validate = useCallback(async () => {
    const info = await apiRequest<SessionInfo>('/api/mobile/v1/session')
    setUser(info.user)
    setMessage(null)
    setStatus('authenticated')
  }, [])

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
  }, [clearSession, refreshDeviceContractStatus, validate])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'authenticated') void validate().catch(() => undefined)
    })
    return () => listener.remove()
  }, [status, validate])

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    let session = await refreshPasswordSession(input)
    let protectedSecretWritten = false
    let enrollmentNotice: string | null = null
    await sessionStore.set(session)
    queryClient.clear()

    const metadata = await deviceContractStore.getMetadata().catch(() => null)
    if (metadata?.registered) {
      setUser(session.user)
      setMessage(null)
      setStatus('authenticated')
      return
    }

    try {
      if (await canEnrollBiometrics()) {
        if (Platform.OS === 'ios') {
          const verified = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Confirme sua identidade para ativar a biometria',
            cancelLabel: 'Agora não',
          })
          if (!verified.success) throw new Error('BIOMETRIC_SETUP_CANCELLED')
        }

        const deviceId = await deviceContractStore.ensureDeviceId()
        const deviceSecret = bytesToHex(await Crypto.getRandomBytesAsync(32))
        await deviceContractStore.setSecret(deviceSecret)
        protectedSecretWritten = true
        const registration: DeviceContractRegistrationInput = { deviceId, deviceSecret, refreshToken: session.refreshToken }
        session = await publicApiRequest<MobileSession>('/api/mobile/v1/session/device-contract', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.accessToken}` },
          body: JSON.stringify(registration),
        })
        await sessionStore.set(session)
        await deviceContractStore.markRegistered(true)
        setHasDeviceContract(true)
        setMessage(null)
      } else {
        enrollmentNotice = 'A biometria não está disponível neste aparelho. Você pode continuar com e-mail e senha.'
        setMessage(enrollmentNotice)
      }
    } catch (error) {
      if (protectedSecretWritten) await deviceContractStore.clearSecret().catch(() => undefined)
      await deviceContractStore.markRegistered(false).catch(() => undefined)
      setHasDeviceContract(false)

      if (error instanceof Error && error.message === 'BIOMETRIC_SETUP_CANCELLED') {
        enrollmentNotice = 'Biometria não ativada. Você pode ativá-la depois entrando com senha.'
        setMessage(enrollmentNotice)
      } else if (error instanceof ApiError && error.status === 401) {
        await sessionStore.clear()
        setMessage('A sessão expirou durante a ativação. Entre novamente com e-mail e senha.')
        setStatus('signed-out')
        setUser(null)
        return
      } else {
        // Re-authentication recovers the session if registration rotated its refresh token before failing.
        try {
          session = await refreshPasswordSession(input)
          await sessionStore.set(session)
        } catch {
          await sessionStore.clear()
          setMessage('A biometria não foi ativada. Entre novamente com e-mail e senha.')
          setStatus('signed-out')
          setUser(null)
          return
        }
        enrollmentNotice = 'A biometria não foi ativada. Você pode continuar usando e-mail e senha.'
        setMessage(enrollmentNotice)
      }
    }

    queryClient.clear()
    setUser(session.user)
    setStatus('authenticated')
    if (enrollmentNotice && Platform.OS !== 'web') Alert.alert('Biometria não ativada', enrollmentNotice)
  }, [])

  const signInWithBiometrics = useCallback(async () => {
    try {
      const metadata = await deviceContractStore.getMetadata()
      if (!metadata?.registered) throw new Error('BIOMETRIC_NOT_REGISTERED')
      const deviceSecret = await deviceContractStore.getSecret()
      if (!deviceSecret) throw new Error('BIOMETRIC_SECRET_MISSING')

      const input: DeviceContractLoginInput = { deviceId: metadata.deviceId, deviceSecret }
      const session = await publicApiRequest<MobileSession>('/api/mobile/v1/session/device', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      await sessionStore.set(session)
      queryClient.clear()
      setUser(session.user)
      setMessage(null)
      setStatus('authenticated')
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await deviceContractStore.clearSecret().catch(() => undefined)
        await deviceContractStore.markRegistered(false).catch(() => undefined)
        setHasDeviceContract(false)
        await clearSession(error.status === 403 ? 'forbidden' : 'signed-out', 'Biometria indisponível para este aparelho. Entre com e-mail e senha.')
        return
      }
      if (error instanceof Error && error.message === 'BIOMETRIC_NOT_REGISTERED') {
        await refreshDeviceContractStatus()
        setMessage('Entre com e-mail e senha para ativar a biometria neste aparelho.')
        return
      }
      if (error instanceof Error && error.message === 'BIOMETRIC_SECRET_MISSING') {
        setHasDeviceContract(false)
        setMessage('A biometria deste aparelho precisa ser configurada novamente. Entre com e-mail e senha.')
        return
      }
      setMessage('Não foi possível entrar com biometria. Tente novamente ou use e-mail e senha.')
    }
  }, [clearSession, refreshDeviceContractStatus])

  const disableBiometrics = useCallback(async () => {
    const metadata = await deviceContractStore.getMetadata()
    if (!metadata?.registered) {
      setHasDeviceContract(false)
      return
    }
    const deviceSecret = await deviceContractStore.getSecret()
    if (!deviceSecret) {
      setHasDeviceContract(false)
      throw new Error('Não foi possível confirmar este aparelho. Entre com e-mail e senha.')
    }

    const input: DeviceContractLoginInput = { deviceId: metadata.deviceId, deviceSecret }
    await publicApiRequest<{ revoked: true }>('/api/mobile/v1/session/device-contract', {
      method: 'DELETE',
      body: JSON.stringify(input),
    })
    await deviceContractStore.clearSecret().catch(() => undefined)
    await deviceContractStore.markRegistered(false)
    setHasDeviceContract(false)
    setMessage(null)
  }, [])

  const signOut = useCallback(async () => {
    await clearSession('signed-out', null)
    await refreshDeviceContractStatus().catch(() => undefined)
  }, [clearSession, refreshDeviceContractStatus])

  const returnToForm = useCallback(() => setStatus('signed-out'), [])
  const value = useMemo(() => ({ status, user, message, hasDeviceContract, signIn, signInWithBiometrics, disableBiometrics, signOut, returnToForm }), [disableBiometrics, hasDeviceContract, message, returnToForm, signIn, signInWithBiometrics, signOut, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
