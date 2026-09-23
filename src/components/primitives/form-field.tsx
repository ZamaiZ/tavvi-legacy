import { useState, type ComponentType } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, spacing, typeStyles, useAppTheme } from '@/theme'

type FieldIcon = ComponentType<{ size?: number; color?: string }>
type Props = TextInputProps & { label: string; error?: string | null; hint?: string; icon?: FieldIcon }

export function FormField({ label, error, hint, icon: Icon, style, secureTextEntry, onFocus, onBlur, ...props }: Props) {
  const { colors } = useAppTheme()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const isPassword = Boolean(secureTextEntry)
  const borderColor = error ? colors.dangerText : focused ? colors.accentText : colors.line

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.field, { borderColor, backgroundColor: colors.field }, focused && { boxShadow: `0 0 0 4px ${colors.accentSurface}` }]}>
        {Icon ? <Icon size={18} color={focused ? colors.accentText : colors.subtle} /> : null}
        <TextInput
          {...props}
          secureTextEntry={isPassword && !revealed}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={colors.muted}
          onFocus={(event) => { setFocused(true); onFocus?.(event) }}
          onBlur={(event) => { setFocused(false); onBlur?.(event) }}
          style={[styles.input, typeStyles.body, { color: colors.foreground }, style]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ selected: revealed }}
            hitSlop={12}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => [styles.reveal, pressed && { opacity: 0.6 }]}
          >
            {revealed ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText variant="caption" tone="danger" accessibilityRole="alert">{error}</AppText> : hint ? <AppText variant="caption" tone="muted">{hint}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.x2 },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderWidth: 1, borderRadius: radii.field, borderCurve: 'continuous', paddingHorizontal: spacing.x4 },
  input: { flex: 1, paddingVertical: spacing.x3 },
  reveal: { padding: spacing.x1 },
})
