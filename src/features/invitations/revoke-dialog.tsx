import { Ban } from 'lucide-react-native'
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native'
import { AppText } from '@/components/primitives/app-text'
import { brand, radii, useAppTheme } from '@/theme'

export function RevokeDialog({ visible, loading, onCancel, onConfirm }: { visible: boolean; loading: boolean; onCancel(): void; onConfirm(): void }) {
  const { colors } = useAppTheme()
  return <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
    <View style={[styles.overlay, { backgroundColor: colors.scrim }]}>
      <Pressable accessibilityLabel="Cancelar revogação" style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
        <View style={[styles.iconTile, { backgroundColor: colors.dangerSurface }]}><Ban size={20} color={colors.dangerText} strokeWidth={1.9} /></View>
        <AppText variant="dialog" maxFontSizeMultiplier={1.5}>Revogar convite?</AppText>
        <AppText variant="meta" tone="muted">O link deixará de funcionar imediatamente.</AppText>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" disabled={loading} onPress={onCancel} style={({ pressed }) => [styles.button, { backgroundColor: colors.field, borderColor: colors.line2, opacity: pressed ? 0.75 : 1 }]}><AppText variant="rowTitle">Cancelar</AppText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Revogar" accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={onConfirm} style={({ pressed }) => [styles.button, styles.confirm, { backgroundColor: colors.dangerText, opacity: pressed ? 0.8 : 1 }]}>{loading ? <ActivityIndicator size={16} color={colors.surface} /> : <AppText variant="rowTitle" style={{ color: colors.surface }}>Revogar</AppText>}</Pressable>
        </View>
      </View>
    </View>
  </Modal>
}

const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }, card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radii.dialog, borderCurve: 'continuous', padding: 22, gap: 10, boxShadow: '0 20px 40px -16px rgba(0,0,0,0.7)' }, iconTile: { width: 46, height: 46, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, actions: { flexDirection: 'row', gap: 10, marginTop: 10 }, button: { flex: 1, height: 50, borderWidth: 1, borderRadius: radii.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, confirm: { borderWidth: 0 } })
