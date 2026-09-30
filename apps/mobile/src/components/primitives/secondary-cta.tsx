import { Pressable, StyleSheet } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function SecondaryCTA({ label, icon: Icon, onPress, disabled }: { label: string; icon: LucideIcon; onPress(): void; disabled?: boolean }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: colors.surface, borderColor: colors.line2, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
    <Icon size={18} color={colors.foreground} strokeWidth={1.9} />
    <AppText variant="rowTitle" numberOfLines={1} style={{ color: colors.foreground }}>{label}</AppText>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 50, borderRadius: radii.cta, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 } })
