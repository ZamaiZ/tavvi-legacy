import { Image } from 'expo-image'
import { CircleAlert } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { AppText } from './app-text'
import { TonalButton } from './tonal-button'
import { radii, useAppTheme } from '@/theme'

const marks = {
  light: require('../../../assets/images/brand/tavvi-brandmark-gold-on-light.png'),
  dark: require('../../../assets/images/brand/tavvi-brandmark-gold-on-dark.png'),
} as const
export function StateCard({ title, message, error = false, actionLabel, actionIcon, onAction, retry }: { title: string; message: string; error?: boolean; actionLabel?: string; actionIcon?: LucideIcon; onAction?: () => void; retry?: boolean }) {
  const { colors, resolved } = useAppTheme()
  const ActionIcon = actionIcon
  return <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    {error ? <View style={[styles.errorTile, { backgroundColor: colors.dangerSurface }]}><CircleAlert size={22} color={colors.dangerText} /></View> : <Image source={marks[resolved]} contentFit="contain" style={styles.mark} />}
    <AppText variant="empty" numberOfLines={2} maxFontSizeMultiplier={1.5} style={styles.center}>{title}</AppText>
    <AppText variant="meta" tone="muted" maxFontSizeMultiplier={1.5} style={styles.message}>{message}</AppText>
    {onAction && actionLabel ? retry ? <TonalButton label={actionLabel} icon={actionIcon} onPress={onAction} compact /> : <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={({ pressed }) => [styles.action, { backgroundColor: colors.button, opacity: pressed ? 0.82 : 1 }]}>{ActionIcon ? <ActionIcon size={18} color={colors.buttonText} strokeWidth={2.1} /> : null}<AppText variant="rowTitle" numberOfLines={1} style={[styles.actionLabel, { color: colors.buttonText }]}>{actionLabel}</AppText></Pressable> : null}
  </View>
}

const styles = StyleSheet.create({ root: { borderWidth: 1, borderRadius: radii.overlay, borderCurve: 'continuous', paddingTop: 34, paddingHorizontal: 24, paddingBottom: 26, alignItems: 'center', gap: 10 }, mark: { width: 64, height: 64, marginBottom: 6 }, errorTile: { width: 52, height: 52, borderRadius: 17, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, action: { height: 46, borderRadius: radii.button, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, actionLabel: {}, center: { textAlign: 'center' }, message: { textAlign: 'center', maxWidth: 260 }, })
