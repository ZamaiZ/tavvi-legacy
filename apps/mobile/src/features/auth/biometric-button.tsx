import * as Haptics from 'expo-haptics'
import { Fingerprint, ScanFace } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { AppText } from '@/components/primitives/app-text'
import { useBiometricAvailability } from './use-biometric-availability'

export type BiometricButtonColors = { field: string; border: string; text: string; muted: string; accent: string }

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
      style={({ pressed }) => [styles.button, { opacity: enabled ? (pressed ? 0.72 : 1) : 0.42 }]}
    >
      <Icon accessible={false} size={18} strokeWidth={1.7} color={enabled ? colors.accent : colors.muted} />
      <AppText family="login" variant="caption" style={{ color: enabled ? colors.accent : colors.muted }}>{authenticating ? 'Reconhecendo…' : `Entrar com ${label}`}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 46, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderCurve: 'continuous' },
})
