import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from '@/components/primitives/app-text'
import { radii, useAppTheme } from '@/theme'

type Props = {
  visible: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  showCancel?: boolean
  icon?: LucideIcon
  onCancel(): void
  onConfirm(): void
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  showCancel = true,
  icon: Icon,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useAppTheme()
  const actionColor = destructive ? colors.dangerText : colors.button
  const actionTextColor = destructive ? colors.surface : colors.buttonText

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
        <Pressable accessibilityLabel="Fechar diálogo" disabled={loading} style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
          {Icon ? <View style={[styles.iconTile, { backgroundColor: destructive ? colors.dangerSurface : colors.goldSoft }]}><Icon size={20} color={destructive ? colors.dangerText : colors.goldText} strokeWidth={1.9} /></View> : null}
          <AppText variant="dialog" maxFontSizeMultiplier={1.5}>{title}</AppText>
          <AppText variant="meta" tone="muted">{description}</AppText>
          <View style={[styles.actions, !showCancel && styles.singleAction]}>
            {showCancel ? (
              <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} accessibilityState={{ disabled: loading }} disabled={loading} onPress={onCancel} style={({ pressed }) => [styles.button, { backgroundColor: colors.field, borderColor: colors.line2, opacity: pressed ? 0.75 : 1 }]}>
                <AppText variant="rowTitle">{cancelLabel}</AppText>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={onConfirm} style={({ pressed }) => [styles.button, styles.confirm, { backgroundColor: actionColor, opacity: pressed ? 0.8 : 1 }]}>
              {loading ? <ActivityIndicator size={16} color={actionTextColor} /> : <AppText variant="rowTitle" style={{ color: actionTextColor }}>{confirmLabel}</AppText>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radii.dialog, borderCurve: 'continuous', padding: 22, gap: 10, boxShadow: '0 20px 40px -16px rgba(0,0,0,0.7)' },
  iconTile: { width: 46, height: 46, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  singleAction: { justifyContent: 'flex-end' },
  button: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: radii.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  confirm: { borderWidth: 0 },
})
