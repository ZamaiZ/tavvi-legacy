import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export type FilterOption<Key extends string> = { key: Key; label: string; count: number }
export function FilterChips<Key extends string>({ options, value, onChange }: { options: FilterOption<Key>[]; value: Key; onChange(key: Key): void }) {
  const { colors } = useAppTheme()
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
    {options.map((option) => {
      const active = option.key === value
      return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(option.key)} style={({ pressed }) => [styles.chip, { backgroundColor: active ? colors.button : colors.surface, borderColor: active ? colors.button : colors.line2 }, pressed && { opacity: 0.78 }]}>
        <AppText variant="rowMeta" numberOfLines={1} style={{ color: active ? colors.buttonText : colors.muted, fontSize: 13, lineHeight: 16, fontWeight: '500' }}>{option.label}</AppText>
        <AppText variant="badge" style={{ color: active ? colors.buttonText : colors.muted, fontWeight: '500', opacity: 0.72 }}>{option.count}</AppText>
      </Pressable>
    })}
  </ScrollView>
}

const styles = StyleSheet.create({ scroll: { marginHorizontal: -16 }, content: { paddingHorizontal: 16, gap: 8 }, chip: { height: 32, borderRadius: radii.chip, borderCurve: 'continuous', borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 } })
