import * as Haptics from 'expo-haptics'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { Fingerprint, ScanFace } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

export type BiometricKind = 'face' | 'fingerprint' | 'biometric'
export type BiometricAvailability =
  | { state: 'checking' }
  | { state: 'available'; kind: BiometricKind; label: string }
  | { state: 'unavailable'; reason: string }

export type BiometricButtonColors = { field: string; border: string; text: string; muted: string }

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

export function BiometricButton({
  colors,
  hasDeviceContract,
  onBiometricSignIn,
  disabled = false,
}: {
  colors: BiometricButtonColors
  hasDeviceContract: boolean
  onBiometricSignIn(): Promise<void>
  disabled?: boolean
}) {
  const availability = useBiometricAvailability()
  const [authenticating, setAuthenticating] = useState(false)
  if (!hasDeviceContract) return null

  const available = availability.state === 'available'
  const enabled = available && !disabled && !authenticating
  const label = available ? availability.label : 'Biometria indisponível'
  const Icon = available && availability.kind === 'fingerprint' ? Fingerprint : ScanFace

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={available ? `Entrar com ${label}` : label}
      accessibilityHint={available ? 'Autentica e entra neste aparelho' : availability.state === 'unavailable' ? availability.reason : 'Verificando disponibilidade'}
      accessibilityState={{ disabled: !enabled, busy: disabled || authenticating || availability.state === 'checking' }}
      disabled={!enabled}
      onPress={() => {
        if (!enabled) return
        void Haptics.selectionAsync()
        setAuthenticating(true)
        void onBiometricSignIn().finally(() => setAuthenticating(false))
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.field, borderColor: colors.border, opacity: enabled ? (pressed ? 0.72 : 1) : 0.42 }]}
    >
      <Icon accessible={false} size={22} strokeWidth={1.7} color={enabled ? colors.text : colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: 58, height: 58, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 20, borderCurve: 'continuous' },
})
