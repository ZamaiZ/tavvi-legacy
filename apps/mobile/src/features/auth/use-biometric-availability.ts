import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'

export type BiometricKind = 'face' | 'fingerprint' | 'biometric'

export type BiometricAvailability =
  | { state: 'checking' }
  | { state: 'available'; kind: BiometricKind; label: string }
  | { state: 'unavailable'; reason: string }

export function useBiometricAvailability(): BiometricAvailability {
  const [availability, setAvailability] = useState<BiometricAvailability>({ state: 'checking' })

  useEffect(() => {
    let active = true
    async function inspect() {
      if (process.env.EXPO_OS === 'web') {
        if (active) setAvailability({ state: 'unavailable', reason: 'Biometria disponível apenas no aplicativo móvel.' })
        return
      }
      try {
        const secureStoreReady = SecureStore.canUseBiometricAuthentication()
        const [hardware, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ])
        if (!active) return
        if (!hardware || !enrolled || !secureStoreReady) {
          const reason = !hardware
            ? 'Este aparelho não possui biometria compatível.'
            : !enrolled
              ? 'Cadastre uma biometria nas configurações do aparelho.'
              : 'A biometria cadastrada não pode proteger o armazenamento deste aparelho.'
          setAvailability({ state: 'unavailable', reason })
          return
        }
        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        if (hasFace) setAvailability({ state: 'available', kind: 'face', label: process.env.EXPO_OS === 'ios' ? 'Face ID' : 'reconhecimento facial' })
        else if (hasFingerprint) setAvailability({ state: 'available', kind: 'fingerprint', label: process.env.EXPO_OS === 'ios' ? 'Touch ID' : 'impressão digital' })
        else setAvailability({ state: 'available', kind: 'biometric', label: 'biometria' })
      } catch {
        if (active) setAvailability({ state: 'unavailable', reason: 'Não foi possível verificar a biometria neste aparelho.' })
      }
    }
    void inspect()
    return () => { active = false }
  }, [])

  return availability
}
