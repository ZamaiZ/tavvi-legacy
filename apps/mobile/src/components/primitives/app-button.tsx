import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { brand, radii, spacing, useAppTheme } from '@/theme'

export type AppButtonProps = {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
  disabled?: boolean
  icon?: ReactNode
  onPress: () => void
  accessibilityLabel?: string
}

export function AppButton({ label, variant = 'primary', size = 'md', loading, disabled, icon, onPress, accessibilityLabel }: AppButtonProps) {
  const { colors } = useAppTheme()
  const backgroundColor = variant === 'primary' ? brand.lime : variant === 'destructive' ? colors.dangerText : variant === 'secondary' ? colors.surface : 'transparent'
  const textColor = variant === 'primary' ? brand.ink : variant === 'destructive' ? colors.surface : colors.foreground
  const blocked = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [styles.base, size === 'sm' && styles.sm, size === 'icon' && styles.icon, { backgroundColor: pressed && variant === 'primary' ? brand.limePressed : backgroundColor, borderColor: colors.line2, borderWidth: variant === 'secondary' ? 1 : 0, opacity: blocked ? 0.5 : 1, transform: [{ scale: pressed && !blocked ? 0.97 : 1 }] }]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <View style={styles.content}>{icon}<AppText variant="label" style={{ color: textColor }}>{label}</AppText></View>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: spacing.x5, borderRadius: radii.button, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  sm: { minHeight: 40, paddingHorizontal: spacing.x4 },
  icon: { width: 44, height: 44, minHeight: 44, paddingHorizontal: 0 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x2 },
})
