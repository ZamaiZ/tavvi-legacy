import * as Clipboard from 'expo-clipboard'
import { ChevronLeft, Link, RotateCcw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { AppText } from '@/components/primitives/app-text'
import { DetailHero } from '@/components/primitives/detail-hero'
import { IconButton } from '@/components/primitives/icon-button'
import { InfoList } from '@/components/primitives/info-list'
import { SectionCard } from '@/components/primitives/section-card'
import { StateCard } from '@/components/primitives/state-card'
import { formatDate } from '@/lib/format'
import { layout, useAppTheme } from '@/theme'
import { useRestaurant } from './queries'
import { getRestaurantPresentation } from './restaurant-presentation'

const publicMenuBase = process.env.EXPO_PUBLIC_MENU_BASE_URL?.replace(/\/+$/, '')
const roleNames: Record<'admin' | 'cashier' | 'attendant' | 'waiter', string> = { admin: 'Administrador', cashier: 'Caixa', attendant: 'Atendente', waiter: 'Garçom' }
function nameInitials(name: string) { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toLocaleUpperCase('pt-BR')).join('') || 'R' }

export function RestaurantDetailScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets(); const { colors } = useAppTheme(); const query = useRestaurant(id); const restaurant = query.data
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const timeout = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timeout) }, [copied])
  const status = restaurant ? getRestaurantPresentation(restaurant) : null
  const fullUrl = restaurant && publicMenuBase ? `${publicMenuBase}/${restaurant.slug}` : null
  async function copyPublicUrl() { if (!fullUrl) return; await Clipboard.setStringAsync(fullUrl); setCopied(true) }

  const body = query.isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.accentText} /></View>
    : query.isError || !restaurant || !status ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : <View style={styles.sections}>
        <DetailHero initials={nameInitials(restaurant.name)} status={status.label} tone={status.tone} title={restaurant.name} meta={restaurant.segment || 'Tipo não informado'} largeTitle />
        <SectionCard title="LINK PÚBLICO"><View style={[styles.publicLink, { backgroundColor: colors.field }]}><Link size={16} color={colors.subtle} strokeWidth={1.8} /><AppText variant="rowMeta" numberOfLines={1} ellipsizeMode="middle" style={styles.slug}>/{restaurant.slug}</AppText><Pressable accessibilityRole="button" accessibilityLabel={copied ? 'Link copiado' : 'Copiar link público'} disabled={!fullUrl} onPress={() => void copyPublicUrl()} style={({ pressed }) => [styles.copyButton, { backgroundColor: copied ? colors.accent : colors.surface, opacity: !fullUrl ? 0.5 : pressed ? 0.72 : 1 }]}><AppText variant="label" style={{ color: copied ? colors.accentOn : colors.foreground }}>{copied ? 'Copiado' : 'Copiar'}</AppText></Pressable></View></SectionCard>
        <SectionCard title="RESPONSÁVEIS">{restaurant.members.length ? <View style={styles.members}>{restaurant.members.map((member) => <View key={member.id} style={styles.member}>
          <View style={[styles.memberAvatar, { backgroundColor: colors.accentSurface }]}><AppText variant="rowMeta" style={{ color: colors.accentText, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5 }}>{nameInitials(member.name)}</AppText></View>
          <View style={styles.memberCopy}><AppText variant="bodyMedium" numberOfLines={1}>{member.name}</AppText><Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${member.email}`)}><AppText variant="rowMeta" tone="muted" numberOfLines={1}>{member.email}</AppText></Pressable></View>
          <AppText variant="badge" numberOfLines={1} style={{ color: colors.subtle }}>{roleNames[member.role]}</AppText>
        </View>)}</View> : <AppText variant="meta" tone="muted">Nenhum responsável cadastrado.</AppText>}</SectionCard>
        <InfoList items={[{ label: 'Criado em', value: formatDate(restaurant.createdAt) }, { label: 'Atualizado em', value: formatDate(restaurant.updatedAt) }]} />
        <AppText variant="rowMeta" style={[styles.readOnly, { color: colors.subtle }]}>Consulta somente leitura</AppText>
      </View>

  return <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.dockReserve + insets.bottom }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accentText} />}>
    <View style={styles.topBar}><IconButton icon={ChevronLeft} label="Voltar" onPress={() => router.back()} /><AppText variant="label" style={styles.topTitle}>Restaurante</AppText><View style={styles.spacer} /></View>
    {body}
  </ScrollView>
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: 14, flexGrow: 1 }, topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topTitle: { position: 'absolute', left: 44, right: 44, textAlign: 'center' }, spacer: { width: 44, height: 44 }, loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' }, sections: { gap: 14 }, publicLink: { height: 52, borderRadius: 16, borderCurve: 'continuous', paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }, slug: { flex: 1, fontFamily: 'JetBrainsMono_500Medium', minWidth: 0 }, copyButton: { minWidth: 40, height: 40, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, members: { gap: 4 }, member: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, memberAvatar: { width: 38, height: 38, borderRadius: 19, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, memberCopy: { flex: 1, minWidth: 0, gap: 1 }, readOnly: { textAlign: 'center', paddingVertical: 4 } })
