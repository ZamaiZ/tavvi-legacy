import * as Haptics from 'expo-haptics'
import { ChevronRight, House, LogOut, Mail, Menu, Store, UserRound, X } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router, usePathname } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, FadeOutUp, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AdaptiveBlurSurface } from './adaptive-blur-surface'
import { AppText } from '@/components/primitives/app-text'
import { ThemeToggle } from '@/components/primitives/theme-toggle'
import { useAuth } from '@/features/auth/auth-context'
import { getInviteState, invitationKeys } from '@/features/invitations/queries'
import type { MobileInvite } from '@/contracts/mobile-api'
import { restaurantKeys } from '@/features/restaurants/queries'
import type { MobileRestaurant } from '@/contracts/mobile-api'
import { brand, layout, motion, radii, useAppTheme } from '@/theme'

export const dockMetrics = { side: 22, height: 64, bottom: layout.dockBottom } as const
export type MobilePanel = 'none' | 'account' | 'menu'

function initials(email?: string | null) {
  return email?.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'TA'
}

export function MobileDock({ panel, setPanel }: { panel: MobilePanel; setPanel(panel: MobilePanel): void }) {
  const insets = useSafeAreaInsets(); const pathname = usePathname(); const queryClient = useQueryClient(); const reducedMotion = useReducedMotion()
  const { colors, preference, setPreference } = useAppTheme(); const { user, signOut } = useAuth()
  const inviteQuery = useQuery({ queryKey: invitationKeys.all, queryFn: async () => [] as MobileInvite[], enabled: false, initialData: () => queryClient.getQueryData<MobileInvite[]>(invitationKeys.all) })
  const restaurantQuery = useQuery({ queryKey: restaurantKeys.all, queryFn: async () => [] as MobileRestaurant[], enabled: false, initialData: () => queryClient.getQueryData<MobileRestaurant[]>(restaurantKeys.all) })
  const pendingCount = inviteQuery.data?.filter((invite) => getInviteState(invite, Date.now()) === 'pending').length
  const restaurantCount = restaurantQuery.data?.length
  const dockBottom = insets.bottom >= 22 ? 22 : insets.bottom + 22
  const panelMotion = reducedMotion ? FadeIn.duration(motion.panelIn).easing(Easing.out(Easing.cubic)) : FadeInDown.duration(motion.panelIn).easing(Easing.bezier(0.16, 1, 0.3, 1))
  const panelExit = reducedMotion ? FadeOut.duration(motion.panelOut) : FadeOutUp.duration(motion.panelOut).easing(Easing.out(Easing.cubic))

  function toggle(next: Exclude<MobilePanel, 'none'>) { void Haptics.selectionAsync(); setPanel(panel === next ? 'none' : next) }
  function go(path: '/' | '/restaurantes') { setPanel('none'); router.replace(path) }
  const invitesActive = pathname === '/' || pathname.startsWith('/convites/')
  const restaurantsActive = pathname.startsWith('/restaurantes')

  return <>
    {panel !== 'none' ? <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.panelOut)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, zIndex: 20 }]}><Pressable accessibilityLabel="Fechar painel" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setPanel('none')} /></Animated.View> : null}

    {panel === 'account' ? <Animated.View entering={panelMotion} exiting={panelExit} style={[styles.accountPosition, { left: 12, bottom: dockBottom + dockMetrics.height + 18 }]}>
      <AdaptiveBlurSurface style={styles.panelSurface}>
        <View style={styles.identity}>
          <View style={styles.avatar}><AppText variant="label" style={styles.avatarText}>{initials(user?.email)}</AppText></View>
          <View style={styles.identityCopy}><AppText variant="rowTitle" numberOfLines={1} style={{ color: colors.foreground, fontSize: 14 }}>{user?.email ?? 'Administrador'}</AppText><AppText variant="rowMeta" tone="muted" numberOfLines={1}>Administrador da plataforma</AppText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar conta" hitSlop={5} onPress={() => setPanel('none')} style={[styles.closeButton, { backgroundColor: colors.field }]}><X size={16} color={colors.muted} /></Pressable>
        </View>
        <View style={styles.themeGroup}><AppText variant="label" tone="muted">Tema</AppText><ThemeToggle value={preference} onChange={setPreference} size={54} /></View>
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, { backgroundColor: pressed ? colors.dangerSurface : 'transparent' }]}><LogOut size={18} color={colors.dangerText} /><AppText variant="rowTitle" style={{ color: colors.dangerText }}>Sair</AppText></Pressable>
      </AdaptiveBlurSurface>
    </Animated.View> : null}

    {panel === 'menu' ? <Animated.View entering={panelMotion} exiting={panelExit} style={[styles.menuPosition, { left: 12, right: 12, bottom: dockBottom + dockMetrics.height + 18 }]}>
      <AdaptiveBlurSurface style={styles.menuSurface}>
        <AppText variant="caps" style={[styles.menuHeading, { color: colors.subtle }]}>NAVEGAÇÃO</AppText>
        <NavigationRow icon={Mail} label="Convites" sub="Acessos de administrador" count={pendingCount == null ? undefined : `${pendingCount} ${pendingCount === 1 ? 'pendente' : 'pendentes'}`} active={invitesActive} onPress={() => go('/')} />
        <NavigationRow icon={Store} label="Restaurantes" sub="Estabelecimentos da plataforma" count={restaurantCount == null ? undefined : String(restaurantCount)} active={restaurantsActive} onPress={() => go('/restaurantes')} />
      </AdaptiveBlurSurface>
    </Animated.View> : null}

    <View style={[styles.dock, { left: dockMetrics.side, right: dockMetrics.side, bottom: dockBottom }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Conta" accessibilityState={{ selected: panel === 'account' }} onPress={() => toggle('account')} style={({ pressed }) => [styles.sideButton, panel === 'account' && styles.activeSideButton, pressed && styles.pressed]}><UserRound size={21} color={panel === 'account' ? brand.lime : '#F4F6F0'} strokeWidth={1.9} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Início" onPress={() => go('/')} style={({ pressed }) => [styles.homeButton, pressed && styles.homePressed]}><House size={20} color={brand.ink} strokeWidth={2} /><AppText variant="rowTitle" style={styles.homeLabel}>Início</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Menu" accessibilityState={{ selected: panel === 'menu' }} onPress={() => toggle('menu')} style={({ pressed }) => [styles.sideButton, panel === 'menu' && styles.activeSideButton, pressed && styles.pressed]}><Menu size={21} color={panel === 'menu' ? brand.lime : '#F4F6F0'} strokeWidth={1.9} /></Pressable>
    </View>
  </>
}

function NavigationRow({ icon: Icon, label, sub, count, active, onPress }: { icon: typeof Mail; label: string; sub: string; count?: string; active: boolean; onPress(): void }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.menuRow, { backgroundColor: active || pressed ? colors.field : 'transparent' }]}>
    <View style={[styles.menuTile, { backgroundColor: active ? brand.lime : colors.field }]}><Icon size={19} color={active ? brand.ink : colors.foreground} strokeWidth={1.8} /></View>
    <View style={styles.menuCopy}><AppText variant="rowTitle" numberOfLines={1}>{label}</AppText><AppText variant="rowMeta" tone="muted" numberOfLines={1}>{sub}</AppText></View>
    {count ? <AppText variant="rowMeta" style={{ color: colors.subtle }}>{count}</AppText> : null}<ChevronRight size={16} color={colors.subtle} />
  </Pressable>
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', height: dockMetrics.height, borderRadius: 32, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(244,246,240,0.10)', backgroundColor: '#121510', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, boxShadow: '0 20px 40px -16px rgba(0,0,0,0.7)' },
  sideButton: { width: 48, height: 48, borderRadius: 24, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, activeSideButton: { backgroundColor: 'rgba(178,245,47,0.14)' },
  homeButton: { height: 48, borderRadius: 24, borderCurve: 'continuous', backgroundColor: brand.lime, paddingLeft: 18, paddingRight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, homePressed: { backgroundColor: brand.limePressed, transform: [{ scale: 0.97 }] }, homeLabel: { color: brand.ink },
  pressed: { opacity: 0.72 }, accountPosition: { position: 'absolute', width: 286, zIndex: 30 }, menuPosition: { position: 'absolute', zIndex: 30 }, panelSurface: { borderRadius: radii.overlay, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(244,246,240,0.14)', padding: 16, gap: 14, overflow: 'hidden', boxShadow: '0 20px 40px -16px rgba(0,0,0,0.7)' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 44, height: 44, borderRadius: 15, borderCurve: 'continuous', backgroundColor: brand.lime, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: brand.ink, fontFamily: 'PlusJakartaSans_800ExtraBold' }, identityCopy: { flex: 1, minWidth: 0, gap: 2 }, closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, themeGroup: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, divider: { height: 1 }, signOut: { height: 46, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuSurface: { borderRadius: radii.overlay, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(244,246,240,0.14)', padding: 8, gap: 4, overflow: 'hidden', boxShadow: '0 20px 40px -16px rgba(0,0,0,0.7)' }, menuHeading: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 6 }, menuRow: { height: 62, borderRadius: 18, borderCurve: 'continuous', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, menuTile: { width: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, menuCopy: { flex: 1, minWidth: 0, gap: 2 },
})
