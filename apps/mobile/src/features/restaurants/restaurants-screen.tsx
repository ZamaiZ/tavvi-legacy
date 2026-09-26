import { RotateCcw } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListRow } from '@/components/primitives/list-row'
import { SearchField } from '@/components/primitives/search-field'
import { SkeletonRow } from '@/components/primitives/skeleton-row'
import { StateCard } from '@/components/primitives/state-card'
import { ListHero } from '@/components/shell/list-hero'
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
  const activeCount = restaurants.filter((restaurant) => restaurant.status === 'active' && !restaurant.deletedAt).length
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return restaurants.filter((restaurant) => `${restaurant.name} ${restaurant.slug}`.toLocaleLowerCase('pt-BR').includes(term))
  }, [restaurants, search])
  const summary = query.isLoading && !query.data ? 'Carregando…' : `${restaurants.length} ${restaurants.length === 1 ? 'restaurante' : 'restaurantes'} · ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`
  const header = <View style={styles.header}><ListHero title="Restaurantes" description="Acompanhe os estabelecimentos, endereços públicos e situação de publicação." summary={summary} /><SearchField value={search} onChangeText={setSearch} placeholder="Buscar restaurante ou /slug" /></View>
  const body = query.isLoading && !query.data ? <View style={styles.stateRows}>{[0, 1, 2].map((key) => <SkeletonRow key={key} />)}</View>
    : query.isError && !query.data ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : restaurants.length === 0 ? <StateCard title="Nenhum restaurante" message="Os restaurantes cadastrados na plataforma aparecem aqui." />
        : visible.length === 0 ? <StateCard title="Nada encontrado" message="Ajuste a busca para ver outros restaurantes." /> : null
  return <FlatList<RestaurantSummary>
    data={body ? [] : visible}
    keyExtractor={(item) => item.id}
    contentInsetAdjustmentBehavior="never"
    contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.dockReserve + insets.bottom }]}
    refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accentText} />}
    ListHeaderComponent={header}
    ListEmptyComponent={body}
    renderItem={({ item }) => { const presentation = getRestaurantPresentation(item); return <ListRow title={item.name} meta={`/${item.slug} · ${item.segment || 'Tipo não informado'}`} initials={restaurantInitials(item.name)} status={presentation.label} tone={presentation.tone} onPress={() => router.push({ pathname: '/restaurants/[id]', params: { id: item.id } })} /> }}
    ItemSeparatorComponent={() => <View style={{ height: layout.listRowGap }} />}
  />
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: layout.listBlockGap, flexGrow: 1 }, header: { gap: layout.listBlockGap }, stateRows: { gap: layout.listRowGap } })
