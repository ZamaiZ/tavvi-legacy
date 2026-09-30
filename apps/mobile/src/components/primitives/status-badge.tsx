import { StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { radii, useAppTheme } from '@/theme'

export type StatusTone = 'accent' | 'success' | 'warning' | 'neutral' | 'danger'
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const { colors } = useAppTheme()
  const foreground = tone === 'accent' ? colors.goldText : tone === 'success' ? colors.successText : tone === 'warning' ? colors.warningText : tone === 'danger' ? colors.dangerText : colors.neutralText
  const background = tone === 'accent' ? colors.goldSoft : tone === 'success' ? colors.successSurface : tone === 'warning' ? colors.warningSurface : tone === 'danger' ? colors.dangerSurface : colors.neutralSurface
  return <View style={[styles.badge, { backgroundColor: background }]}><AppText variant="badge" numberOfLines={1} style={{ color: foreground }}>{label}</AppText></View>
}

const styles = StyleSheet.create({ badge: { height: 24, borderRadius: radii.chip, borderCurve: 'continuous', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 } })
