import { ChevronRight, Mail } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { StatusBadge, type StatusTone } from './status-badge'
import { radii, useAppTheme } from '@/theme'

export function ListRow({ title, meta, status, tone, onPress, initials }: { title: string; meta: string; status: string; tone: StatusTone; onPress(): void; initials?: string }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.root, { backgroundColor: colors.surface, borderColor: pressed ? colors.line2 : colors.line }]}>
    <View style={[styles.tile, { backgroundColor: colors.field }]}>{initials ? <AppText variant="label" numberOfLines={1} style={{ color: colors.goldText, fontSize: 13 }}>{initials}</AppText> : <Mail size={18} color={colors.muted} strokeWidth={1.8} />}</View>
    <View style={styles.copy}><AppText variant="rowTitle" numberOfLines={1} ellipsizeMode="tail">{title}</AppText><AppText variant="rowMeta" tone="muted" numberOfLines={1} ellipsizeMode="tail">{meta}</AppText></View>
    <StatusBadge label={status} tone={tone} /><ChevronRight size={16} color={colors.subtle} strokeWidth={1.8} />
  </Pressable>
}

const styles = StyleSheet.create({ root: { minHeight: 72, borderWidth: 1, borderRadius: radii.card, borderCurve: 'continuous', paddingVertical: 14, paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, tile: { width: 42, height: 42, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, minWidth: 0, gap: 3 } })
