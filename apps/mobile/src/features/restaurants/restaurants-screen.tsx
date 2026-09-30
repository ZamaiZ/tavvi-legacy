import { RotateCcw, Store } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListRow } from '@/components/primitives/list-row'
import { SearchField } from '@/components/primitives/search-field'
import { SkeletonRow } from '@/components/primitives/skeleton-row'
import { StateCard } from '@/components/primitives/state-card'
import { AppText } from '@/components/primitives/app-text'
import { layout, useAppTheme } from '@/theme'
import { useRestaurants } from './queries'
import { getRestaurantPresentation } from './restaurant-presentation'
import type { RestaurantSummary } from '@tavvi/api-contracts'

const ignored = new Set(['do', 'da', 'de', 'e'])
function restaurantInitials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => word && !ignored.has(word.toLocaleLowerCase('pt-BR')))
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2) || 'R').toLocaleUpperCase('pt-BR')
}

export function RestaurantsScreen() {
  const insets = useSafeAreaInsets(); const { colors } = useAppTheme(); const query = useRestaurants(); const [search, setSearch] = useState('')
  const restaurants = query.data ?? []
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.slug}`.toLocaleLowerCase('pt-BR').includes(term))
  }, [restaurants, search])
  const header = <View style={styles.header}><View style={styles.heading}><View style={styles.headingCopy}><AppText variant="display" maxFontSizeMultiplier={1.35} style={styles.title}>Restaurantes</AppText><AppText variant="meta" tone="muted">Estabelecimentos da plataforma</AppText></View><View style={[styles.headingIcon, { backgroundColor: colors.goldSoft }]}><Store size={19} color={colors.goldText} strokeWidth={1.8} /></View></View><SearchField value={search} onChangeText={setSearch} placeholder="Buscar restaurante ou /slug" /></View>
  const body = query.isLoading && !query.data ? <View style={styles.stateRows}>{[0, 1, 2].map((key) => <SkeletonRow key={key} />)}</View>
    : query.isError && !query.data ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : restaurants.length === 0 ? <StateCard title="Nenhum restaurante" message="Os restaurantes cadastrados na plataforma aparecem aqui." />
        : visible.length === 0 ? <StateCard title="Nada encontrado" message="Ajuste a busca para ver outros restaurantes." /> : null
  return <FlatList<RestaurantSummary>
    data={body ? [] : visible}
    keyExtractor={(item) => item.id}
    contentInsetAdjustmentBehavior="never"
    contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.contentBottom + insets.bottom }]}
    ListHeaderComponentStyle={styles.listHeader}
    refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.goldText} />}
    ListHeaderComponent={header}
    ListEmptyComponent={body}
    renderItem={({ item }) => { const presentation = getRestaurantPresentation(item); return <ListRow title={item.name} meta={`/${item.slug} · ${item.segment || 'Tipo não informado'}`} initials={restaurantInitials(item.name)} status={presentation.label} tone={presentation.tone} onPress={() => router.push({ pathname: '/restaurants/[id]', params: { id: item.id } })} /> }}
    ItemSeparatorComponent={() => <View style={{ height: layout.listRowGap }} />}
  />
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, flexGrow: 1 }, listHeader: { marginBottom: 14 }, header: { gap: 14 }, heading: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 }, headingCopy: { flex: 1, minWidth: 0, gap: 4 }, title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8 }, headingIcon: { width: 38, height: 38, borderRadius: 11, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, stateRows: { gap: layout.listRowGap } })
