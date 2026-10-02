import type { AppNotification, NotificationKind } from '@tavvi/api-contracts'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Bell, BellOff, BellRing, CheckCheck, ChevronLeft, MessageSquareText, RotateCcw, Settings, Store, UserPlus, type LucideIcon } from 'lucide-react-native'
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppText } from '@/components/primitives/app-text'
import { SkeletonRow } from '@/components/primitives/skeleton-row'
import { StateCard } from '@/components/primitives/state-card'
import { toast } from '@/components/primitives/toast'
import { TonalButton } from '@/components/primitives/tonal-button'
import { formatRelative } from '@/lib/format'
import { layout, radii, useAppTheme } from '@/theme'
import { openNotificationTarget } from './notification-runtime'
import {
  useDevicePush,
  useDisablePush,
  useEnablePush,
  useMarkAllRead,
  useMarkRead,
  useSendTestNotification,
  useUnreadCount,
  useUnreadNotifications,
} from './queries'

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  feedback_received: MessageSquareText,
  team_member_joined: UserPlus,
  restaurant_joined: Store,
  test: BellRing,
}

function showError(error: unknown) {
  toast.show(error instanceof Error && error.message ? error.message : 'Tente novamente.', { type: 'error' })
}

// "Neste aparelho": o push deste celular, em quatro estados.
function DeviceSection() {
  const { colors } = useAppTheme()
  const device = useDevicePush()
  const enable = useEnablePush()
  const disable = useDisablePush()
  const state = device.data

  let hint = 'Avisos mesmo com o app fechado'
  let action: ReactNode = <TonalButton compact variant="primary" icon={Bell} label={enable.isPending ? 'Ativando…' : 'Ativar notificações'} loading={enable.isPending} disabled={!state} onPress={() => enable.mutate(undefined, { onError: showError })} />
  if (state?.permission === 'unsupported') {
    hint = 'Disponíveis só no app do celular'
    action = null
  } else if (state?.permission === 'blocked') {
    hint = 'Bloqueadas nos ajustes do celular'
    action = <TonalButton compact icon={Settings} label="Abrir ajustes" onPress={() => void Linking.openSettings()} />
  } else if (state?.enabled) {
    hint = 'Ativas neste aparelho'
    action = <TonalButton compact icon={BellOff} label={disable.isPending ? 'Desativando…' : 'Desativar notificações'} loading={disable.isPending} onPress={() => disable.mutate(undefined, { onError: showError })} />
  }

  return <View style={styles.section}>
    <AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>Neste aparelho</AppText>
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <AppText variant="rowMeta" style={{ color: colors.muted }}>{hint}</AppText>
      {action}
    </View>
  </View>
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress(): void }) {
  const { colors } = useAppTheme()
  const Icon = KIND_ICONS[item.kind]
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.field : colors.surface }]}>
    <View style={[styles.rowIcon, { backgroundColor: colors.goldSoft }]}><Icon size={16} color={colors.goldText} strokeWidth={1.9} /></View>
    <View style={styles.rowCopy}>
      <AppText variant="rowTitle" style={{ color: colors.foreground }}>{item.title}</AppText>
      <AppText variant="rowMeta" numberOfLines={2} style={{ color: colors.muted }}>{item.body}</AppText>
      <AppText variant="badge" style={{ color: colors.subtle }}>{formatRelative(item.createdAt)}</AppText>
    </View>
  </Pressable>
}

// Central do console no app: o mesmo conteúdo da central web (aparelho,
// teste e não lidas). Aberta pela folha Conta e pelo toque no push.
export function NotificationCenterScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()
  const list = useUnreadNotifications()
  const count = useUnreadCount()
  const device = useDevicePush()
  const test = useSendTestNotification()
  const markAll = useMarkAllRead()
  const markOne = useMarkRead()
  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  const unread = count.data ?? 0
  const refreshing = list.isRefetching && !list.isFetchingNextPage

  function refresh() {
    void list.refetch()
    void count.refetch()
    void device.refetch()
  }

  // Na própria central, tocar marca como lida; só o restaurante leva a
  // outra tela.
  function openItem(item: AppNotification) {
    markOne.mutate(item.id, { onError: showError })
    if (item.kind === 'restaurant_joined' && item.restaurantId) openNotificationTarget(item.kind, item.restaurantId)
  }

  const header = <View style={styles.header}>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/') }} style={styles.backAction}>
        <ChevronLeft size={24} color={colors.goldText} strokeWidth={2.1} />
        <AppText variant="rowTitle" style={{ color: colors.goldText }}>Voltar</AppText>
      </Pressable>
    </View>
    <AppText variant="display" maxFontSizeMultiplier={1.35}>Notificações</AppText>
    <DeviceSection />
    <TonalButton compact icon={BellRing} label={test.isPending ? 'Enviando…' : 'Enviar notificação de teste'} loading={test.isPending} onPress={() => test.mutate(undefined, { onError: showError })} />
    <View style={styles.listHead}>
      <AppText variant="caps" style={{ color: colors.subtle }}>Não lidas{unread > 0 ? ` (${unread > 99 ? '99+' : unread})` : ''}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: unread === 0 || markAll.isPending, busy: markAll.isPending }}
        disabled={unread === 0 || markAll.isPending}
        onPress={() => markAll.mutate(undefined, { onError: showError })}
        hitSlop={6}
        style={({ pressed }) => [styles.markAll, { opacity: unread === 0 ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        {markAll.isPending ? <ActivityIndicator size={14} color={colors.goldText} /> : <CheckCheck size={15} color={colors.goldText} strokeWidth={2} />}
        <AppText variant="label" style={{ color: colors.goldText }}>{markAll.isPending ? 'Marcando…' : 'Marcar todas como lidas'}</AppText>
      </Pressable>
    </View>
  </View>

  const empty = list.isLoading ? <View style={styles.stateRows}>{[0, 1, 2].map((key) => <SkeletonRow key={key} />)}</View>
    : list.isError ? <StateCard error title="Não foi possível carregar" message={list.error instanceof Error && list.error.message ? list.error.message : 'Tente novamente.'} retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void list.refetch()} />
      : <StateCard title="Tudo em dia" message="Nenhuma notificação nova." />

  const footer = list.hasNextPage ? <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy: list.isFetchingNextPage }}
    disabled={list.isFetchingNextPage}
    onPress={() => void list.fetchNextPage()}
    style={({ pressed }) => [styles.more, { opacity: pressed ? 0.7 : 1 }]}
  >
    {list.isFetchingNextPage ? <ActivityIndicator size={14} color={colors.goldText} /> : null}
    <AppText variant="label" style={{ color: colors.goldText }}>{list.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}</AppText>
  </Pressable> : null

  return <FlatList
    data={list.isError ? [] : items}
    keyExtractor={(item) => item.id}
    contentInsetAdjustmentBehavior="never"
    contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.contentBottom + insets.bottom }]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.goldText} />}
    ListHeaderComponent={header}
    ListHeaderComponentStyle={styles.listHeader}
    ListEmptyComponent={empty}
    ListFooterComponent={footer}
    renderItem={({ item }) => <NotificationRow item={item} onPress={() => openItem(item)} />}
    ItemSeparatorComponent={() => <View style={styles.separator} />}
  />
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.screenHorizontal, flexGrow: 1 },
  listHeader: { marginBottom: 10 },
  header: { gap: 16 },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  backAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6 },
  section: { gap: 6 },
  sectionLabel: { paddingLeft: 14 },
  card: { padding: 12, gap: 10, borderRadius: radii.card, borderCurve: 'continuous' },
  listHead: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 14, marginTop: 6 },
  markAll: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radii.card, borderCurve: 'continuous' },
  rowIcon: { width: 32, height: 32, borderRadius: radii.tileSm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  separator: { height: 6 },
  stateRows: { gap: layout.listRowGap },
  more: { minHeight: 44, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
