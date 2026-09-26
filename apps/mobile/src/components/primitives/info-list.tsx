import { StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export function InfoList({ items }: { items: { label: string; value: string }[] }) {
  const { colors } = useAppTheme()
  return <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.line }]}>{items.map((item, index) => <View key={`${item.label}-${index}`} style={[styles.row, index < items.length - 1 && { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}><AppText variant="rowMeta" tone="muted" numberOfLines={1}>{item.label}</AppText><AppText variant="rowMeta" numberOfLines={2} style={styles.value}>{item.value}</AppText></View>)}</View>
}

const styles = StyleSheet.create({ root: { borderWidth: 1, borderRadius: radii.panel, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 6 }, row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, value: { fontSize: 13.5, fontWeight: '600', textAlign: 'right', flexShrink: 1 } })
