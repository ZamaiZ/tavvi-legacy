import * as Crypto from 'expo-crypto'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useCallback } from 'react'
import { Platform } from 'react-native'
import { API_ROUTES, type DeviceContractLoginInput, type DeviceContractRegistrationInput, type AuthSession, type SessionSnapshot } from '@tavvi/api-contracts'
import { ApiError, apiRequest, publicApiRequest } from '@/lib/api-client'
import { deviceContractStore } from './device-contract-store'
import type { AuthStateSetters } from './auth-types'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'

type UseDeviceContractAuthInput = AuthStateSetters & {
  setHasDeviceContract(value: boolean): void
  clearSession(next: 'signed-out' | 'forbidden', nextMessage: string | null): Promise<void>
  refreshDeviceContractStatus(): Promise<void>
}

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

export function useDeviceContractAuth({ setStatus, setUser, setMessage, setHasDeviceContract, clearSession, refreshDeviceContractStatus }: UseDeviceContractAuthInput) {
  const enableBiometrics = useCallback(async () => {
    if (!await canEnrollBiometrics()) throw new Error('A biometria não está disponível neste aparelho.')

    const snapshot = await apiRequest<SessionSnapshot>(API_ROUTES.auth.session)
    const session = await sessionStore.get()
    if (!session || session.user.id !== snapshot.user.id) throw new ApiError('Sua sessão expirou. Entre novamente.', 401, 'UNAUTHORIZED')
    const existing = await deviceContractStore.getMetadata()
    if (existing?.registered) {
      setHasDeviceContract(true)
      return
    }

    if (Platform.OS === 'ios') {
      const verified = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade para ativar a biometria',
        cancelLabel: 'Agora não',
      })
      if (!verified.success) throw new Error('BIOMETRIC_SETUP_CANCELLED')
    }

    const deviceId = await deviceContractStore.ensureDeviceId()
    const deviceSecret = bytesToHex(await Crypto.getRandomBytesAsync(32))
    let protectedSecretWritten = false
    try {
      await deviceContractStore.setSecret(deviceSecret)
      protectedSecretWritten = true
      const registration: DeviceContractRegistrationInput = { deviceId, deviceSecret, refreshToken: session.refreshToken }
      const nextSession = await publicApiRequest<AuthSession>(API_ROUTES.auth.deviceContract, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(registration),
      })
      await sessionStore.set(nextSession)
      await deviceContractStore.markRegistered(true)
      setHasDeviceContract(true)
      setMessage(null)
    } catch (error) {
      if (protectedSecretWritten) await deviceContractStore.clearSecret().catch(() => undefined)
      await deviceContractStore.markRegistered(false).catch(() => undefined)
      setHasDeviceContract(false)
      throw error
    }
  }, [setHasDeviceContract, setMessage])

  const signInWithBiometrics = useCallback(async () => {
    try {
      const metadata = await deviceContractStore.getMetadata()
      if (!metadata?.registered) throw new Error('BIOMETRIC_NOT_REGISTERED')
      const deviceSecret = await deviceContractStore.getSecret()
      if (!deviceSecret) throw new Error('BIOMETRIC_SECRET_MISSING')

      const input: DeviceContractLoginInput = { deviceId: metadata.deviceId, deviceSecret }
      const session = await publicApiRequest<AuthSession>(API_ROUTES.auth.deviceLogin, {
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
  }, [clearSession, refreshDeviceContractStatus, setHasDeviceContract, setMessage, setStatus, setUser])

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
    await publicApiRequest<{ revoked: true }>(API_ROUTES.auth.deviceContract, {
      method: 'DELETE',
      body: JSON.stringify(input),
    })
    await deviceContractStore.clearSecret().catch(() => undefined)
    await deviceContractStore.markRegistered(false)
    setHasDeviceContract(false)
    setMessage(null)
  }, [setHasDeviceContract, setMessage])

  return { signInWithBiometrics, enableBiometrics, disableBiometrics }
}
