import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CircleAlert, Fingerprint, LogOut, ScanFace, ShieldCheck } from 'lucide-react-native'
import { Switch } from '@expo/ui'
import { AppText } from '@/components/primitives/app-text'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'
import { ThemeSelector } from '@/components/primitives/theme-selector'
import { useAuth } from '@/features/auth/auth-context'
import { useBiometricAvailability } from '@/features/auth/use-biometric-availability'
import { useAppTheme } from '@/theme'

export default function AccountScreen() {
  const { colors, preference, setPreference } = useAppTheme()
  const insets = useSafeAreaInsets()
  const { user, hasDeviceContract, enableBiometrics, disableBiometrics, signOut } = useAuth()
  const biometric = useBiometricAvailability()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'disable' | 'signOut' | 'error' | null>(null)
  const [dialogError, setDialogError] = useState('')

  async function turnOnBiometrics() {
    setBusy(true)
    try {
      await enableBiometrics()
    } catch (error) {
      if (!(error instanceof Error && error.message === 'BIOMETRIC_SETUP_CANCELLED')) {
        setDialogError(error instanceof Error ? error.message : 'Tente novamente.')
        setDialog('error')
      }
    } finally {
      setBusy(false)
    }
  }

  function handleBiometricChange(enabled: boolean) {
    if (enabled) void turnOnBiometrics()
    else setDialog('disable')
  }

  async function confirmDialog() {
    if (dialog === 'disable') {
      setBusy(true)
      try {
        await disableBiometrics()
        setDialog(null)
      } catch (error) {
        setDialogError(error instanceof Error ? error.message : 'Tente novamente.')
        setDialog('error')
      } finally {
        setBusy(false)
      }
      return
    }

    if (dialog === 'signOut') {
      await signOut()
      setDialog(null)
    } else if (dialog === 'error') {
      setDialog(null)
    }
  }

  const biometricLabel = biometric.state === 'available' ? biometric.label : process.env.EXPO_OS === 'ios' ? 'Face ID' : 'biometria'
  const switchLabel = `Entrar com ${biometricLabel}`
  const biometricReason = biometric.state === 'unavailable' ? biometric.reason : null

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: 32 + insets.bottom }]}
      style={{ backgroundColor: colors.background }}
    >
      <AppText variant="display" maxFontSizeMultiplier={1.35} style={styles.pageTitle}>Conta</AppText>

      <View style={[styles.profile, { backgroundColor: colors.surface }]}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.gold }]}>
          <AppText variant="title" style={{ color: colors.goldInk }}>{user?.email?.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'A'}</AppText>
        </View>
        <View style={styles.profileCopy}>
          <AppText variant="heading" numberOfLines={1} style={{ color: colors.foreground }}>{user?.email ?? 'Administrador da plataforma'}</AppText>
          <AppText variant="rowMeta" style={{ color: colors.muted }}>Administrador da plataforma</AppText>
        </View>
      </View>

      <View style={styles.labeledGroup}>
        <AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>APARÊNCIA</AppText>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <ThemeSelector value={preference} onChange={(value) => void setPreference(value)} />
        </View>
      </View>

      <View style={styles.labeledGroup}>
        <AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>SEGURANÇA</AppText>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          <View style={styles.biometricRow}>
            <View style={[styles.iconTile, { backgroundColor: colors.goldSoft }]}>
              {hasDeviceContract ? <ShieldCheck size={19} color={colors.goldText} /> : biometricLabel === 'Face ID' ? <ScanFace size={19} color={colors.goldText} /> : <Fingerprint size={19} color={colors.goldText} />}
            </View>
            <Switch
              value={hasDeviceContract}
              label={switchLabel}
              disabled={busy || (!hasDeviceContract && biometric.state !== 'available')}
              onValueChange={handleBiometricChange}
            />
          </View>
          {biometricReason ? <AppText variant="rowMeta" style={{ color: colors.subtle }}>{biometricReason}</AppText> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setDialog('signOut')}
        style={({ pressed }) => [styles.signOut, { backgroundColor: pressed ? colors.dangerSurface : colors.surface }]}
      >
        <LogOut size={19} color={colors.dangerText} />
        <AppText variant="bodyMedium" style={{ color: colors.dangerText }}>Sair</AppText>
      </Pressable>
      <ConfirmDialog
        visible={dialog !== null}
        title={dialog === 'disable' ? 'Desativar biometria?' : dialog === 'signOut' ? 'Sair da conta?' : 'Não foi possível atualizar a biometria'}
        description={dialog === 'disable'
          ? 'Você poderá ativá-la novamente nesta tela após confirmar sua identidade.'
          : dialog === 'signOut'
            ? 'Você precisará entrar novamente para acessar o console.'
            : dialogError}
        confirmLabel={dialog === 'disable' ? 'Desativar' : dialog === 'signOut' ? 'Sair da conta' : 'Entendi'}
        destructive={dialog === 'disable' || dialog === 'signOut'}
        loading={busy}
        showCancel={dialog !== 'error'}
        icon={dialog === 'error' ? CircleAlert : undefined}
        onCancel={() => { if (!busy) setDialog(null) }}
        onConfirm={() => void confirmDialog()}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 16 },
  pageTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 },
  profile: { minHeight: 68, padding: 12, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  labeledGroup: { gap: 6 },
  sectionLabel: { paddingLeft: 14 },
  group: { borderRadius: 14, borderCurve: 'continuous', padding: 8, gap: 12 },
  biometricRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  iconTile: { width: 34, height: 34, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  signOut: { minHeight: 48, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
})
