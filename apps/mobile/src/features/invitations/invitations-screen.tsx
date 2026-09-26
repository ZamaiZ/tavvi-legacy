import { Plus, RotateCcw } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { PlatformInvitation } from '@tavvi/api-contracts'
import { CompactCTA } from '@/components/primitives/compact-cta'
import { FilterChips, type FilterOption } from '@/components/primitives/filter-chips'
import { ListRow } from '@/components/primitives/list-row'
import { SearchField } from '@/components/primitives/search-field'
import { SkeletonRow } from '@/components/primitives/skeleton-row'
import { StateCard } from '@/components/primitives/state-card'
import { AppText } from '@/components/primitives/app-text'
import { ListHero } from '@/components/shell/list-hero'
import { formatDate } from '@/lib/format'
import { layout, useAppTheme } from '@/theme'
import { CreateInvitationSheet } from './create-invitation-sheet'
import { useInvitations } from './queries'
import { getInviteState, type InviteState } from './invitation-state'

type FilterKey = 'all' | InviteState
const filterOrder: FilterKey[] = ['all', 'pending', 'redeemed', 'expired', 'revoked']
const filterLabels: Record<FilterKey, string> = { all: 'Todos', pending: 'Pendentes', redeemed: 'Resgatados', expired: 'Vencidos', revoked: 'Revogados' }
const status: Record<InviteState, { label: string; tone: 'accent' | 'success' | 'warning' | 'neutral' }> = {
  pending: { label: 'Pendente', tone: 'accent' }, redeemed: { label: 'Resgatado', tone: 'success' }, expired: { label: 'Vencido', tone: 'warning' }, revoked: { label: 'Revogado', tone: 'neutral' },
}

function inviteMeta(invite: PlatformInvitation, state: InviteState) {
  if (state === 'redeemed') return `Resgatado em ${formatDate(invite.redeemedAt!)}`
  if (state === 'revoked') return `Revogado em ${formatDate(invite.revokedAt!)}`
  if (state === 'expired') return `Venceu em ${formatDate(invite.expiresAt)}`
  return `Válido até ${formatDate(invite.expiresAt)}`
}

export function InvitationsScreen() {
  const insets = useSafeAreaInsets(); const { colors } = useAppTheme()
  const query = useInvitations(); const [sheet, setSheet] = useState(false); const [search, setSearch] = useState(''); const [filter, setFilter] = useState<FilterKey>('all'); const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id) }, [])
  const invites = query.data ?? []
  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { all: invites.length, pending: 0, redeemed: 0, expired: 0, revoked: 0 }
    invites.forEach((invite) => { result[getInviteState(invite, now)] += 1 })
    return result
  }, [invites, now])
  const filters: FilterOption<FilterKey>[] = filterOrder.map((key) => ({ key, label: filterLabels[key], count: counts[key] }))
  const visible = useMemo(() => invites.filter((invite) => {
    const state = getInviteState(invite, now)
    const matchesFilter = filter === 'all' || state === filter
    const searchable = (invite.email ?? 'qualquer e-mail').toLocaleLowerCase('pt-BR')
    return matchesFilter && searchable.includes(search.trim().toLocaleLowerCase('pt-BR'))
  }), [filter, invites, now, search])
  const pending = counts.pending
  const summary = query.isLoading && !query.data ? 'Carregando…' : `${invites.length} ${invites.length === 1 ? 'convite' : 'convites'} · ${pending} ${pending === 1 ? 'pendente' : 'pendentes'}`

  const header = <View style={styles.header}>
    <ListHero title="Convites" description="Crie acessos seguros para novos administradores." summary={summary} action={{ label: 'Novo convite', onPress: () => setSheet(true) }} />
    <SearchField value={search} onChangeText={setSearch} placeholder="Buscar por e-mail" />
    <FilterChips options={filters} value={filter} onChange={setFilter} />
  </View>
  const body = query.isLoading && !query.data ? <View style={styles.stateRows}>{[0, 1, 2].map((key) => <SkeletonRow key={key} />)}</View>
    : query.isError && !query.data ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" onAction={() => void query.refetch()} actionIcon={RotateCcw} />
      : invites.length === 0 ? <StateCard title="Nenhum convite ainda" message="Crie um link para dar acesso a um novo administrador." actionLabel="Criar convite" actionIcon={Plus} onAction={() => setSheet(true)} />
        : visible.length === 0 ? <StateCard title="Nada encontrado" message="Ajuste a busca ou o filtro para ver outros resultados." />
          : null

  return <>
    <FlatList
      data={body ? [] : visible}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.dockReserve + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accentText} />}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
      renderItem={({ item }) => { const state = getInviteState(item, now); return <ListRow title={item.email || 'Qualquer e-mail'} meta={inviteMeta(item, state)} status={status[state].label} tone={status[state].tone} onPress={() => router.push({ pathname: '/invitations/[id]', params: { id: item.id } })} /> }}
      ItemSeparatorComponent={() => <View style={{ height: layout.listRowGap }} />}
      ListFooterComponent={query.isError && query.data ? <AppText variant="rowMeta" tone="danger" style={styles.refreshError}>Atualização indisponível</AppText> : null}
    />
    <CreateInvitationSheet open={sheet} onOpenChange={setSheet} onComplete={() => setFilter('all')} />
  </>
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: layout.listBlockGap, flexGrow: 1 }, header: { gap: layout.listBlockGap }, stateRows: { gap: layout.listRowGap }, refreshError: { paddingTop: 12, textAlign: 'center' } })
