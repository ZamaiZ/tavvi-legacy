import { BottomSheet, RNHostView } from '@expo/ui'
import { LogOut, MonitorSmartphone } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, LinearGradient, Stop } from 'react-native-svg'
import { AppText } from '@/components/primitives/app-text'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'
import { ThemeSelector } from '@/components/primitives/theme-selector'
import { toast } from '@/components/primitives/toast'
import { useAuth } from '@/features/auth/auth-context'
import { brand, radii, useAppTheme } from '@/theme'

// Aba Conta: sheet com Tema, Sair e Sair de todos os aparelhos, aberto pelo
// toque na aba (ver app/(app)/_layout.tsx). O liga/desliga da biometria fica
// fora da interface; desativar continua na tela de login.
export function AccountSheet({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { colors, resolved, preference, setPreference } = useAppTheme()
  const { user, signOut, signOutEverywhere } = useAuth()
  const [confirm, setConfirm] = useState<'signOut' | 'everywhere' | null>(null)
  const [endingAll, setEndingAll] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const gradient = resolved === 'dark' ? brand.heroGradientDark : brand.heroGradient
  const ink = resolved === 'dark' ? '#17120A' : brand.heroInk
  const initial = user?.email?.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'A'

  // O sheet é nativo: a confirmação aparece com ele fechado e, se a pessoa
  // cancelar, ele volta (mesmo padrão do "Descartar link?" do convite).
  function ask(kind: 'signOut' | 'everywhere') {
    onOpenChange(false)
    setConfirm(kind)
  }

  function cancelConfirm() {
    if (endingAll) return
    setConfirm(null)
    onOpenChange(true)
  }

  function confirmSignOut() {
    setConfirm(null)
    void signOut()
  }

  // Falhou: continua logado, com a causa (spec 2026-10-01). Deu certo: o app
  // volta ao login e o toast confirma.
  async function confirmSignOutEverywhere() {
    setEndingAll(true)
    try {
      await signOutEverywhere()
      setConfirm(null)
      toast.show('Você saiu de todos os aparelhos.')
    } catch (error) {
      setConfirm(null)
      setFailure(error instanceof Error && error.message ? error.message : 'Tente novamente.')
    } finally {
      setEndingAll(false)
    }
  }

  return (
    <>
    <BottomSheet isPresented={open} onDismiss={() => onOpenChange(false)} showDragIndicator={false} snapPoints={['half']} contentPadding={0} containerColor={colors.background}>
      <RNHostView>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.line2 }]} />
          <View style={[styles.profile, { backgroundColor: colors.surface }]}>
            <View style={styles.avatar}>
              <Svg width={52} height={52} style={StyleSheet.absoluteFill} accessible={false}>
                <LinearGradient id="accountAvatarGold" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={gradient[0]} />
                  <Stop offset="0.52" stopColor={gradient[1]} />
                  <Stop offset="1" stopColor={gradient[2]} />
                </LinearGradient>
                <Circle cx={26} cy={26} r={26} fill="url(#accountAvatarGold)" />
              </Svg>
              <AppText variant="heading" style={[styles.initial, { color: ink }]}>{initial}</AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText variant="heading" numberOfLines={1} style={{ color: colors.foreground }}>{user?.email ?? 'Conta'}</AppText>
              <AppText variant="rowMeta" style={{ color: colors.subtle }}>Administrador da plataforma</AppText>
            </View>
          </View>
          <View style={styles.group}>
            <AppText variant="caps" style={[styles.groupLabel, { color: colors.subtle }]}>Aparência</AppText>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ThemeSelector value={preference} onChange={(value) => void setPreference(value)} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => ask('signOut')}
            style={({ pressed }) => [styles.signOut, { backgroundColor: pressed ? colors.dangerSurface : colors.surface }]}
          >
            <LogOut size={18} color={colors.dangerText} />
            <AppText variant="bodyMedium" style={{ color: colors.dangerText }}>Sair</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => ask('everywhere')}
            style={({ pressed }) => [styles.signOutAll, { opacity: pressed ? 0.7 : 1 }]}
          >
            <AppText variant="rowMeta" style={{ color: colors.dangerText }}>Sair de todos os aparelhos</AppText>
          </Pressable>
        </View>
      </RNHostView>
    </BottomSheet>
    <ConfirmDialog
      visible={confirm === 'signOut'}
      title="Sair da conta?"
      description="Você precisará entrar novamente para acessar o console."
      confirmLabel="Sair da conta"
      destructive
      icon={LogOut}
      onCancel={cancelConfirm}
      onConfirm={confirmSignOut}
    />
    <ConfirmDialog
      visible={confirm === 'everywhere'}
      title="Sair de todos os aparelhos?"
      description="Isso encerra sua sessão em todos os aparelhos e desliga a digital em todos eles, inclusive neste."
      confirmLabel="Sair de todos"
      destructive
      loading={endingAll}
      icon={MonitorSmartphone}
      onCancel={cancelConfirm}
      onConfirm={() => void confirmSignOutEverywhere()}
    />
    <ConfirmDialog
      visible={failure !== null}
      title="Não foi possível sair de todos"
      description={failure ?? ''}
      confirmLabel="Entendi"
      showCancel={false}
      icon={MonitorSmartphone}
      onCancel={() => setFailure(null)}
      onConfirm={() => setFailure(null)}
    />
    </>
  )
}

const styles = StyleSheet.create({
  sheet: { flex: 1, width: '100%', alignSelf: 'stretch', paddingTop: 8, paddingHorizontal: 16, paddingBottom: 26, gap: 16, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderCurve: 'continuous' },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center' },
  profile: { minHeight: 76, padding: 12, borderRadius: radii.card, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, lineHeight: 24 },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  group: { gap: 6 },
  groupLabel: { paddingLeft: 14 },
  card: { padding: 8, borderRadius: radii.card, borderCurve: 'continuous' },
  signOut: { minHeight: 48, paddingHorizontal: 16, borderRadius: radii.card, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  signOutAll: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
