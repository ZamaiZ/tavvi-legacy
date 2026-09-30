import * as Crypto from 'expo-crypto'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useCallback } from 'react'
import { Platform } from 'react-native'
import { ApiError, publicApiRequest } from '@/lib/api-client'
import { deviceContractStore } from './device-contract-store'
import type { AuthStateSetters } from './auth-types'
import { API_ROUTES, type DeviceContractRegistrationInput, type AuthSession } from '@tavvi/api-contracts'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'

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
  return publicApiRequest<AuthSession>(API_ROUTES.auth.login, {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function usePasswordSignIn({ setStatus, setUser, setMessage, setHasDeviceContract }: AuthStateSetters & { setHasDeviceContract(value: boolean): void }) {
  return useCallback(async (input: { email: string; password: string }) => {
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
        session = await publicApiRequest<AuthSession>(API_ROUTES.auth.deviceContract, {
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
  }, [setHasDeviceContract, setMessage, setStatus, setUser])
}
