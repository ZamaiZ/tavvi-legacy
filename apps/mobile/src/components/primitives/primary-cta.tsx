import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from './app-text'
import { brand, radii } from '@/theme'

export function PrimaryCTA({ label, icon: Icon, onPress, loading, loadingLabel, disabled }: { label: string; icon: LucideIcon; onPress(): void; loading?: boolean; loadingLabel?: string; disabled?: boolean }) {
  const blocked = Boolean(loading || disabled)
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked} onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: pressed ? brand.limePressed : brand.lime, opacity: blocked ? 0.55 : 1, transform: [{ scale: pressed && !blocked ? 0.985 : 1 }] }]}>
    <AppText variant="rowTitle" numberOfLines={1} maxFontSizeMultiplier={1.5} style={styles.label}>{loading ? loadingLabel ?? '…ando…' : label}</AppText>
    <View style={styles.knob}>{loading ? <ActivityIndicator size={16} color={brand.lime} /> : <Icon size={18} color={brand.lime} strokeWidth={2.1} />}</View>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 58, borderRadius: radii.cta, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 7, boxShadow: '0 10px 28px -10px rgba(178,245,47,0.55)' }, label: { color: brand.ink, flexShrink: 1 }, knob: { width: 44, height: 44, borderRadius: radii.tile, borderCurve: 'continuous', backgroundColor: brand.ink, alignItems: 'center', justifyContent: 'center' } })
