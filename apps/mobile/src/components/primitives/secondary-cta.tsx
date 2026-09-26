import { Pressable, StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function SecondaryCTA({ label, icon: Icon, onPress, disabled }: { label: string; icon: LucideIcon; onPress(): void; disabled?: boolean }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: colors.surface, borderColor: colors.line2, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed && !disabled ? 0.985 : 1 }] }]}>
    <AppText variant="rowTitle" numberOfLines={1} style={{ color: colors.foreground, flexShrink: 1 }}>{label}</AppText>
    <View style={[styles.knob, { backgroundColor: colors.accent }]}><Icon size={18} color={colors.accentOn} strokeWidth={2.1} /></View>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 58, borderRadius: radii.cta, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 7 }, knob: { width: 44, height: 44, borderRadius: radii.tile, alignItems: 'center', justifyContent: 'center' } })
