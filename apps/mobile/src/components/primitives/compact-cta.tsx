import { Pressable, StyleSheet } from 'react-native'
import { Plus } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function CompactCTA({ label, onPress }: { label: string; onPress(): void }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: pressed ? colors.accentPressed : colors.accent, boxShadow: `0 10px 24px -10px ${colors.accentCtaGlow}`, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
    <Plus size={18} color={colors.accentOn} strokeWidth={2.2} /><AppText variant="label" numberOfLines={1} style={[styles.label, { color: colors.accentOn }]}>{label}</AppText>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 44, borderRadius: radii.button, borderCurve: 'continuous', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }, label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 18, fontWeight: '700', flexShrink: 1 } })
