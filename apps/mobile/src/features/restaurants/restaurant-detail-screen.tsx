import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { ChevronLeft, Link, RotateCcw } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { BackHandler, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { z } from 'zod'
import { AppText } from '@/components/primitives/app-text'
import { DetailHero } from '@/components/primitives/detail-hero'
import { InfoList } from '@/components/primitives/info-list'
import { DetailSkeleton } from '@/components/primitives/detail-skeleton'
import { StateCard } from '@/components/primitives/state-card'
import { formatDate } from '@/lib/format'
import { isNotFoundError } from '@/lib/api-client'
import { NotFoundScreen } from '@/features/not-found/not-found-screen'
import { layout, useAppTheme } from '@/theme'
import { useRestaurant } from './queries'
import { getRestaurantPresentation } from './restaurant-presentation'

const publicMenuBase = process.env.EXPO_PUBLIC_MENU_BASE_URL?.replace(/\/+$/, '') || 'https://tavvi.app'
const roleNames: Record<'admin' | 'cashier' | 'attendant' | 'waiter', string> = { admin: 'Administrador', cashier: 'Caixa', attendant: 'Atendente', waiter: 'Garçom' }
function nameInitials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toLocaleUpperCase('pt-BR')).join('') || 'R' }

// As listas do app só abrem ids UUID. Qualquer outra coisa veio de um link
// digitado ou antigo: é 404 sem nem chamar a API.
const idSchema = z.string().uuid()

export function RestaurantDetailScreen({ id }: { id: string }) {
  const validId = idSchema.safeParse(id).success
  const insets = useSafeAreaInsets(); const { colors } = useAppTheme(); const query = useRestaurant(validId ? id : ''); const restaurant = query.data
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/restaurants')
      return true
    })
    return () => subscription.remove()
  }, []))
  useEffect(() => { if (!copied) return; const timeout = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timeout) }, [copied])
  const status = restaurant ? getRestaurantPresentation(restaurant) : null
  const fullUrl = restaurant && publicMenuBase ? `${publicMenuBase}/${restaurant.slug}` : null
  async function copyPublicUrl() {
    if (!fullUrl) return
    setCopyError(null)
    try {
      await Clipboard.setStringAsync(fullUrl)
      setCopied(true)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      setCopyError('Não foi possível copiar. Selecione o endereço e copie manualmente.')
    }
  }

  // Depois de todos os hooks. Restaurante inexistente é a 404 do console, e
  // não "verifique sua conexão". Erro de rede e 5xx seguem no cartão com
  // "Tentar novamente". O voltar do Android continua indo a /restaurants
  // (useFocusEffect acima).
  if (!validId || isNotFoundError(query.error)) return <NotFoundScreen backHref="/restaurants" />

  const body = query.isLoading ? <DetailSkeleton kind="restaurant" />
    : query.isError || !restaurant || !status ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : <View style={styles.sections}>
        <DetailHero variant="restaurant" initials={nameInitials(restaurant.name)} status={status.label} tone={status.tone} title={restaurant.name} meta={restaurant.segment || 'Tipo não informado'} />
        <View style={styles.labeledSection}><AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>LINK PÚBLICO</AppText><View style={[styles.publicLink, { backgroundColor: colors.surface }]}><Link size={16} color={colors.subtle} strokeWidth={1.8} /><AppText variant="rowMeta" selectable numberOfLines={1} ellipsizeMode="middle" style={styles.slug}>{fullUrl?.replace(/^https?:\/\//, '')}</AppText><Pressable accessibilityRole="button" accessibilityLabel={copied ? 'Link copiado' : 'Copiar link público'} disabled={!fullUrl} onPress={() => void copyPublicUrl()} style={({ pressed }) => [styles.copyButton, { backgroundColor: copied ? colors.gold : colors.surface, borderColor: colors.line2, opacity: pressed ? 0.72 : 1 }]}><AppText variant="label" style={{ color: copied ? colors.goldInk : colors.foreground }}>{copied ? 'Copiado' : 'Copiar'}</AppText></Pressable></View>{copyError ? <AppText variant="rowMeta" tone="danger" accessibilityRole="alert">{copyError}</AppText> : null}</View>
        <View style={styles.labeledSection}><AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>RESPONSÁVEIS</AppText><View style={[styles.memberCard, { backgroundColor: colors.surface }]}>{restaurant.members.length ? <View style={styles.members}>{restaurant.members.map((member) => <View key={member.id} style={styles.member}>
          <View style={[styles.memberAvatar, { backgroundColor: colors.goldSoft }]}><AppText variant="rowMeta" style={{ color: colors.goldText, fontSize: 12.5 }}>{nameInitials(member.name)}</AppText></View>
          <View style={styles.memberCopy}><AppText variant="bodyMedium" numberOfLines={1}>{member.name}</AppText><Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${member.email}`)}><AppText variant="rowMeta" tone="muted" numberOfLines={1}>{member.email}</AppText></Pressable></View>
          <AppText variant="badge" numberOfLines={1} style={{ color: colors.subtle }}>{roleNames[member.role]}</AppText>
        </View>)}</View> : <AppText variant="meta" tone="muted">Nenhum responsável cadastrado.</AppText>}</View></View>
        <InfoList items={[{ label: 'Criado em', value: formatDate(restaurant.createdAt) }, { label: 'Atualizado em', value: formatDate(restaurant.updatedAt) }]} />
        <AppText variant="rowMeta" style={[styles.readOnly, { color: colors.subtle }]}>Consulta somente leitura</AppText>
      </View>

  return <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.contentBottom + insets.bottom }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.goldText} />}>
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Voltar para restaurantes" onPress={() => router.replace('/restaurants')} style={styles.backAction}><ChevronLeft size={24} color={colors.goldText} strokeWidth={2.1} /><AppText variant="rowTitle" style={{ color: colors.goldText }}>Restaurantes</AppText></Pressable></View>
    {body}
  </ScrollView>
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: 14, flexGrow: 1 }, topBar: { height: 48, flexDirection: 'row', alignItems: 'center' }, backAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 0, paddingRight: 12 }, sections: { gap: 16 }, labeledSection: { gap: 6 }, sectionLabel: { paddingLeft: 14 }, publicLink: { minHeight: 52, borderRadius: 14, borderCurve: 'continuous', paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }, slug: { flex: 1, fontFamily: 'monospace', minWidth: 0 }, copyButton: { minWidth: 64, minHeight: 44, borderWidth: 1, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, memberCard: { borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, overflow: 'hidden' }, members: { gap: 4 }, member: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, memberAvatar: { width: 38, height: 38, borderRadius: 19, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, memberCopy: { flex: 1, minWidth: 0, gap: 1 }, readOnly: { textAlign: 'center', paddingVertical: 4 } })
