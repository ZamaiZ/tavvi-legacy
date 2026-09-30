import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function PrimaryCTA({ label, icon: Icon, onPress, loading, loadingLabel, disabled }: { label: string; icon: LucideIcon; onPress(): void; loading?: boolean; loadingLabel?: string; disabled?: boolean }) {
  const blocked = Boolean(loading || disabled)
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: colors.button, opacity: blocked ? 0.55 : pressed ? 0.82 : 1 }]}>
    <AppText variant="rowTitle" numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.label, { color: colors.buttonText }]}>{loading ? loadingLabel ?? 'Aguarde…' : label}</AppText>
    <View style={[styles.knob, { backgroundColor: colors.buttonText }]}>{loading ? <ActivityIndicator size={16} color={colors.button} /> : <Icon size={18} color={colors.button} strokeWidth={2.1} />}</View>
  </Pressable>
}

const styles = StyleSheet.create({ root: { minHeight: 52, borderRadius: radii.cta, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 7 }, label: { flexShrink: 1 }, knob: { width: 38, height: 38, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' } })
