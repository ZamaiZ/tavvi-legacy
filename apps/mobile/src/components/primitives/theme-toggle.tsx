import * as Haptics from 'expo-haptics'
import { Monitor, Moon, Sun } from 'lucide-react-native'
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { radii, useAppTheme, type ThemePreference } from '@/theme'

const cycle: readonly ThemePreference[] = ['system', 'light', 'dark']
const meta = {
  system: { Icon: Monitor, label: 'Sistema' },
  light: { Icon: Sun, label: 'Claro' },
  dark: { Icon: Moon, label: 'Escuro' },
} as const

type ThemeToggleProps = {
  value: ThemePreference
  onChange(next: ThemePreference): void
  size?: number
  style?: StyleProp<ViewStyle>
}

export function ThemeToggle({ value, onChange, size = 44, style }: ThemeToggleProps) {
  const { colors } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const spin = useSharedValue(0)
  const scale = useSharedValue(1)
  const { Icon } = meta[value]

  function advance() {
    const next = cycle[(cycle.indexOf(value) + 1) % cycle.length]
    void Haptics.selectionAsync()
    if (!reducedMotion) {
      spin.value = withTiming(spin.value + 1, { duration: 340 })
      scale.value = withSequence(withTiming(0.84, { duration: 110 }), withSpring(1, { damping: 11, stiffness: 220 }))
    }
    onChange(next)
  }

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }, { scale: scale.value }] }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Alternar tema"
      accessibilityHint="Alterna entre Sistema, Claro e Escuro"
      hitSlop={10}
      onPress={advance}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, backgroundColor: colors.surface, borderColor: colors.line2 },
        style,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon size={19} color={colors.foreground} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderRadius: 19, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
})
