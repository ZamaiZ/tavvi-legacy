import * as Crypto from 'expo-crypto'
import * as LocalAuthentication from 'expo-local-authentication'
import { useCallback } from 'react'
import { API_ROUTES, type AuthSession, type DeviceContractLoginInput, type DeviceContractRegistered, type DeviceContractRegistrationInput } from '@tavvi/api-contracts'
import { ApiError, apiRequest, publicApiRequest } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'
import type { AuthStateSetters } from './auth-types'
import { classifyLocalAuthError, classifySecureStoreError, describeError, LOCKOUT_MESSAGE } from './biometric-errors'
import { inspectBiometricSupport } from './biometric-support'
import { deviceContractStore } from './device-contract-store'

type UseDeviceContractAuthInput = AuthStateSetters & {
  setHasDeviceContract(value: boolean): void
}

// O servidor disse que este aparelho não entra mais com a digital: o segredo
// local deixa de servir e sai. Conta bloqueada, limite, rede e Supabase fora
// não entram aqui: a digital continua valendo.
export const DEVICE_GONE_CODES = new Set(['DEVICE_NOT_REGISTERED', 'DEVICE_REVOKED', 'ADMIN_ACCESS_REMOVED', 'ACCOUNT_NOT_FOUND'])

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Ler o segredo é o que pede a biometria. Falha que não é cancelamento nem
// bloqueio chega com a mensagem nativa, para a causa aparecer.
function readFailureMessage(error: unknown) {
  if (classifySecureStoreError(error) === 'lockout') return LOCKOUT_MESSAGE
  console.warn('[biometria] leitura do segredo falhou', error)
  return `Não foi possível ler a digital neste aparelho: ${describeError(error)}`
}

export function useDeviceContractAuth({ setStatus, setUser, setMessage, setHasDeviceContract }: UseDeviceContractAuthInput) {
  // Chamado pelo "Ativar" do diálogo, com a sessão aberta. 'cancelled' quando
  // a pessoa recusa o pedido de biometria: vale como "Agora não".
  const enableBiometrics = useCallback(async (): Promise<'enabled' | 'cancelled'> => {
    const support = await inspectBiometricSupport()
    if (!support.available) throw new Error(support.reason)

    // No iOS, criar o valor no SecureStore não pede biometria, então a
    // confirmação vem antes. No Android, o próprio setSecret pede.
    if (process.env.EXPO_OS === 'ios') {
      const verified = await LocalAuthentication.authenticateAsync({
        promptMessage: `Confirme sua identidade para ativar ${support.phrase}`,
        cancelLabel: 'Agora não',
      })
      if (!verified.success) {
        const failure = classifyLocalAuthError(verified.error)
        if (failure === 'cancelled') return 'cancelled'
        throw new Error(failure === 'lockout' ? LOCKOUT_MESSAGE : `Não foi possível confirmar a biometria (${verified.error}).`)
      }
    }

    const deviceId = await deviceContractStore.ensureDeviceId()
    const deviceSecret = bytesToHex(await Crypto.getRandomBytesAsync(32))
    try {
      await deviceContractStore.setSecret(deviceSecret)
    } catch (error) {
      const failure = classifySecureStoreError(error)
      if (failure === 'cancelled') return 'cancelled'
      if (failure === 'lockout') throw new Error(LOCKOUT_MESSAGE)
      console.warn('[biometria] gravação do segredo falhou', error)
      throw new Error('Não foi possível guardar a digital neste aparelho.')
    }

    try {
      const input: DeviceContractRegistrationInput = { deviceId, deviceSecret }
      await apiRequest<DeviceContractRegistered>(API_ROUTES.auth.deviceContract, { method: 'POST', body: JSON.stringify(input) })
      await deviceContractStore.markRegistered(true)
      setHasDeviceContract(true)
      return 'enabled'
    } catch (error) {
      await deviceContractStore.deactivate().catch(() => undefined)
      setHasDeviceContract(false)
      throw error
    }
  }, [setHasDeviceContract])

  const signInWithBiometrics = useCallback(async () => {
    const metadata = await deviceContractStore.getMetadata()
    if (!metadata?.registered) {
      setHasDeviceContract(false)
      setMessage('Este aparelho não tem digital ativa. Entre com e-mail e senha para ativar.')
      return
    }

    let deviceSecret: string | null
    try {
      deviceSecret = await deviceContractStore.getSecret()
    } catch (error) {
      if (classifySecureStoreError(error) === 'cancelled') return
      setMessage(readFailureMessage(error))
      return
    }
    if (!deviceSecret) {
      await deviceContractStore.deactivate().catch(() => undefined)
      setHasDeviceContract(false)
      setMessage('As digitais do celular mudaram. Entre com e-mail e senha para ativar de novo.')
      return
    }

    try {
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
      if (error instanceof ApiError && DEVICE_GONE_CODES.has(error.code)) {
        await deviceContractStore.deactivate().catch(() => undefined)
        setHasDeviceContract(false)
      }
      setMessage(error instanceof Error && error.message ? error.message : 'Não foi possível entrar com a digital. Tente novamente ou use e-mail e senha.')
    }
  }, [setHasDeviceContract, setMessage, setStatus, setUser])

  // Sem o segredo (chave invalidada pelo sistema), o servidor não aceita a
  // prova: desliga só aqui, e a próxima ativação sobrescreve o registro.
  const disableBiometrics = useCallback(async (): Promise<'disabled' | 'cancelled'> => {
    const metadata = await deviceContractStore.getMetadata()
    if (!metadata?.registered) {
      setHasDeviceContract(false)
      return 'disabled'
    }

    let deviceSecret: string | null
    try {
      deviceSecret = await deviceContractStore.getSecret()
    } catch (error) {
      if (classifySecureStoreError(error) === 'cancelled') return 'cancelled'
      throw new Error(readFailureMessage(error))
    }

    if (deviceSecret) {
      const input: DeviceContractLoginInput = { deviceId: metadata.deviceId, deviceSecret }
      try {
        await publicApiRequest<{ revoked: true }>(API_ROUTES.auth.deviceContract, { method: 'DELETE', body: JSON.stringify(input) })
      } catch (error) {
        if (!(error instanceof ApiError && DEVICE_GONE_CODES.has(error.code))) throw error
      }
    }
    await deviceContractStore.deactivate()
    setHasDeviceContract(false)
    setMessage(null)
    return 'disabled'
  }, [setHasDeviceContract, setMessage])

  return { signInWithBiometrics, enableBiometrics, disableBiometrics }
}
