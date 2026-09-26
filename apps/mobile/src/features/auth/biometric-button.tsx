import * as Haptics from 'expo-haptics'
import { Fingerprint, ScanFace } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useBiometricAvailability } from './use-biometric-availability'

export type BiometricButtonColors = { field: string; border: string; text: string; muted: string }

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
