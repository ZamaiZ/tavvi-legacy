import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme, type ThemePreference } from '@/theme'

const options: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' },
]

export function ThemeSelector({ value, onChange }: { value: ThemePreference; onChange(next: ThemePreference): void }) {
  const { colors } = useAppTheme()
  return (
    <View accessibilityRole="radiogroup" style={[styles.root, { backgroundColor: colors.field }]}>
      {options.map(({ value: option, label }) => {
        const active = value === option
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, selected: active }}
            accessibilityLabel={`Tema ${label}`}
            onPress={() => { void Haptics.selectionAsync(); onChange(option) }}
            style={({ pressed }) => [styles.option, active && { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }, pressed && { opacity: 0.75 }]}
          >
            <AppText numberOfLines={1} variant="rowMeta" style={{ color: active ? colors.foreground : colors.muted }}>{label}</AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { width: '100%', flexDirection: 'row', borderRadius: radii.control, borderCurve: 'continuous', padding: 4, gap: 4 },
  option: { flex: 1, minWidth: 0, height: 38, borderRadius: radii.chip, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
})
