import { useState, type ComponentType } from 'react'
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { AppText } from '@/components/primitives/app-text'
import { loginTypeStyles } from '@/theme'
import type { LoginPalette } from './login-theme'

type LoginFieldProps = TextInputProps & {
  label: string
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number; accessible?: boolean }>
  palette: LoginPalette
  error?: string | null
}

export function LoginField({ label, icon: Icon, palette, error, secureTextEntry, onFocus, onBlur, style, ...props }: LoginFieldProps) {
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const isPassword = Boolean(secureTextEntry)
  const borderColor = error ? palette.error : focused ? palette.focus : palette.border

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.field,
          {
            paddingRight: isPassword ? 8 : 16,
            backgroundColor: palette.field,
            borderColor,
          },
        ]}
      >
        <Icon accessible={false} size={18} strokeWidth={1.7} color={focused ? palette.focus : palette.subtle} />
        <TextInput
          {...props}
          secureTextEntry={isPassword && !revealed}
          accessibilityLabel={props.accessibilityLabel ?? label}
          placeholderTextColor={palette.subtle}
          onFocus={(event) => { setFocused(true); onFocus?.(event) }}
          onBlur={(event) => { setFocused(false); onBlur?.(event) }}
          style={[styles.input, loginTypeStyles.body, { color: palette.text }, style]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ selected: revealed }}
            hitSlop={4}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => [styles.reveal, pressed && { opacity: 0.6 }]}
          >
            {revealed
              ? <EyeOff accessible={false} size={18} strokeWidth={1.7} color={palette.subtle} />
              : <Eye accessible={false} size={18} strokeWidth={1.7} color={palette.subtle} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText family="login" variant="caption" style={{ color: palette.error }} accessibilityRole="alert">{error}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 0 },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, borderWidth: 1, borderRadius: 13, borderCurve: 'continuous' },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 16 },
  reveal: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous' },
})
