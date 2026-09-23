import * as Haptics from 'expo-haptics'
import * as LocalAuthentication from 'expo-local-authentication'
import { Fingerprint, ScanFace } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet } from 'react-native'

export type BiometricKind = 'face' | 'fingerprint' | 'biometric'

export type BiometricAvailability =
  | { state: 'checking' }
  | { state: 'available'; kind: BiometricKind; label: string }
  | { state: 'unavailable'; reason: string }

export type BiometricButtonColors = {
  field: string
  border: string
  text: string
  muted: string
}

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
        const [hardware, enrolled, types] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
        ])

        if (!active) return
        if (!hardware) {
          setAvailability({ state: 'unavailable', reason: 'Este aparelho não possui biometria compatível.' })
          return
        }
        if (!enrolled) {
          setAvailability({ state: 'unavailable', reason: 'Cadastre uma biometria nas configurações do aparelho.' })
          return
        }

        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        if (hasFace) {
          setAvailability({ state: 'available', kind: 'face', label: process.env.EXPO_OS === 'ios' ? 'Face ID' : 'Reconhecimento facial' })
        } else if (hasFingerprint) {
          setAvailability({ state: 'available', kind: 'fingerprint', label: process.env.EXPO_OS === 'ios' ? 'Touch ID' : 'Impressão digital' })
        } else {
          setAvailability({ state: 'available', kind: 'biometric', label: 'Biometria' })
        }
      } catch {
        if (active) setAvailability({ state: 'unavailable', reason: 'Não foi possível verificar a biometria neste aparelho.' })
      }
    }

    void inspect()
    return () => { active = false }
  }, [])

  return availability
}

export function BiometricButton({ colors }: { colors: BiometricButtonColors }) {
  const availability = useBiometricAvailability()
  const available = availability.state === 'available'
  const label = available ? availability.label : 'Biometria indisponível'
  const Icon = available && availability.kind === 'fingerprint' ? Fingerprint : ScanFace

  function explain() {
    if (!available) return
    void Haptics.selectionAsync()
    Alert.alert(
      availability.label,
      'Entre com e-mail e senha neste primeiro acesso. A ativação do desbloqueio biométrico será disponibilizada em uma etapa própria.',
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={available ? `Sobre acesso com ${label}` : label}
      accessibilityHint={available ? 'Explica como a biometria será ativada' : availability.state === 'unavailable' ? availability.reason : 'Verificando disponibilidade'}
      accessibilityState={{ disabled: !available, busy: availability.state === 'checking' }}
      disabled={!available}
      onPress={explain}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.field, borderColor: colors.line, opacity: available ? (pressed ? 0.72 : 1) : 0.42 },
      ]}
    >
      <Icon accessible={false} size={22} strokeWidth={1.7} color={available ? colors.text : colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
})
