import { ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function TonalButton({ label, icon: Icon, variant = 'neutral', onPress, loading, disabled, compact }: { label: string; icon?: LucideIcon; variant?: 'danger' | 'neutral' | 'primary'; onPress(): void; loading?: boolean; disabled?: boolean; compact?: boolean }) {
  const { colors } = useAppTheme(); const danger = variant === 'danger'; const primary = variant === 'primary'; const pill = primary || danger; const blocked = Boolean(loading || disabled)
  const foreground = primary ? colors.buttonText : danger ? colors.dangerText : colors.foreground
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: loading }} disabled={blocked} onPress={onPress} style={({ pressed }) => [styles.root, compact && styles.compact, pill && styles.pill, { backgroundColor: primary ? colors.button : danger ? colors.dangerSurface : colors.field, borderColor: danger || primary ? 'transparent' : colors.line2, borderWidth: danger || primary ? 0 : 1, opacity: blocked ? 0.55 : 1 }, pressed && !blocked && { opacity: 0.8 }]}>
    {loading ? <ActivityIndicator size={16} color={foreground} /> : Icon ? <Icon size={18} color={foreground} strokeWidth={1.9} /> : null}
    <AppText variant="rowTitle" numberOfLines={1} style={{ color: foreground, fontSize: pill ? 16 : 14.5, lineHeight: 20 }}>{label}</AppText>
  </Pressable>
}

const styles = StyleSheet.create({ root: { height: 54, borderRadius: radii.control, borderCurve: 'continuous', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, pill: { height: 50, borderRadius: radii.full, borderCurve: 'continuous' }, compact: { height: 46, borderRadius: radii.button, borderCurve: 'continuous' } })
