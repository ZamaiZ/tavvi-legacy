import * as Haptics from 'expo-haptics'
import { Ban, ChevronLeft, Mail, RotateCcw } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { InviteState } from './queries'
import { useInvitation, useRevokeInvitation } from './queries'
import { getInviteState } from './invitation-state'
import { AppText } from '@/components/primitives/app-text'
import { DetailHero } from '@/components/primitives/detail-hero'
import { IconButton } from '@/components/primitives/icon-button'
import { InfoList } from '@/components/primitives/info-list'
import { PrimaryCTA } from '@/components/primitives/primary-cta'
import { SectionCard } from '@/components/primitives/section-card'
import { SecondaryCTA } from '@/components/primitives/secondary-cta'
import { StateCard } from '@/components/primitives/state-card'
import { TonalButton } from '@/components/primitives/tonal-button'
import { RevokeDialog } from './revoke-dialog'
import { CreateInvitationSheet } from './create-invitation-sheet'
import { formatDate } from '@/lib/format'
import { layout, useAppTheme } from '@/theme'

const labels: Record<InviteState, { status: string; tone: 'accent' | 'success' | 'warning' | 'neutral'; meta: (date: string) => string }> = {
  pending: { status: 'Pendente', tone: 'accent', meta: (date) => `Válido até ${date}` },
  redeemed: { status: 'Resgatado', tone: 'success', meta: (date) => `Resgatado em ${date}` },
  revoked: { status: 'Revogado', tone: 'neutral', meta: (date) => `Revogado em ${date}` },
  expired: { status: 'Vencido', tone: 'warning', meta: (date) => `Venceu em ${date}` },
}

export function InvitationDetailScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets(); const { colors } = useAppTheme(); const query = useInvitation(id); const revoke = useRevokeInvitation()
  const [dialog, setDialog] = useState(false); const [sheet, setSheet] = useState(false); const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer) }, [])
  const state = useMemo(() => query.data ? getInviteState(query.data, now) : null, [now, query.data])
  const invite = query.data
  const remainingDays = invite ? Math.max(1, Math.min(30, Math.ceil((Date.parse(invite.expiresAt) - Date.now()) / 86_400_000))) : 7

  async function confirmRevoke() {
    if (!invite) return
    revoke.mutate(invite.id, { onSuccess: () => { setDialog(false); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) } })
  }
  const body = query.isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.accentText} /></View>
    : query.isError || !invite || !state ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : <View style={styles.sections}>
        <DetailHero icon={Mail} status={labels[state].status} tone={labels[state].tone} title={invite.email || 'Qualquer e-mail'} meta={labels[state].meta(formatDate(state === 'redeemed' ? invite.redeemedAt! : state === 'revoked' ? invite.revokedAt! : invite.expiresAt))} />
        <InfoList items={[{ label: 'Criado em', value: formatDate(invite.createdAt) }, { label: 'Válido até', value: formatDate(invite.expiresAt) }, { label: 'Destinatário', value: invite.email ? 'E-mail definido' : 'Qualquer e-mail' }]} />
        <SectionCard title="HISTÓRICO"><View style={styles.timeline}>
          <TimelineEvent title="Criado" meta={`${formatDate(invite.createdAt)} · por ${invite.createdByEmail}`} tone="neutral" />
          {state === 'redeemed' ? <TimelineEvent title="Resgatado" meta={`${formatDate(invite.redeemedAt!)} · ${invite.redeemedByEmail ?? invite.email ?? 'Administrador'}`} tone="success" /> : null}
          {state === 'revoked' ? <TimelineEvent title="Revogado" meta={formatDate(invite.revokedAt!)} tone="danger" /> : null}
          {state === 'expired' ? <TimelineEvent title="Venceu" meta={formatDate(invite.expiresAt)} tone="warning" /> : null}
          {state === 'pending' ? <TimelineEvent title="Aguardando resgate" meta={`Válido até ${formatDate(invite.expiresAt)}`} tone="accent" /> : null}
        </View></SectionCard>
        <View style={styles.actions}>
          {state === 'pending' ? <><PrimaryCTA label="Gerar novo link" icon={RotateCcw} onPress={() => setSheet(true)} /><TonalButton label="Revogar convite" icon={Ban} variant="danger" onPress={() => setDialog(true)} /></>
            : <SecondaryCTA label="Gerar novo convite" icon={RotateCcw} onPress={() => setSheet(true)} />}
        </View>
      </View>

  return <>
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.dockReserve + insets.bottom }]}>
      <View style={styles.topBar}><IconButton icon={ChevronLeft} label="Voltar" onPress={() => router.back()} /><AppText variant="label" style={styles.topTitle}>Convite</AppText><View style={styles.topSpacer} /></View>
      {body}
    </ScrollView>
    <RevokeDialog visible={dialog} loading={revoke.isPending} onCancel={() => setDialog(false)} onConfirm={() => void confirmRevoke()} />
    <CreateInvitationSheet open={sheet} onOpenChange={setSheet} initialEmail={invite?.email ?? ''} initialDays={state === 'pending' ? remainingDays : 7} rotateInviteId={state === 'pending' ? invite?.id : undefined} />
  </>
}

function TimelineEvent({ title, meta, tone }: { title: string; meta: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }) {
  const { colors } = useAppTheme()
  const palette = { neutral: [colors.neutralText, colors.neutralSurface], success: [colors.successText, colors.successSurface], warning: [colors.warningText, colors.warningSurface], danger: [colors.dangerText, colors.dangerSurface], accent: [colors.accentText, colors.accentSurface] } as const
  const [color, halo] = palette[tone]
  return <View style={styles.event}><View style={[styles.dotHalo, { backgroundColor: halo }]}><View style={[styles.dot, { backgroundColor: color }]} /></View><View style={styles.eventCopy}><AppText variant="bodyMedium" style={{ color: colors.foreground }}>{title}</AppText><AppText variant="rowMeta" tone="muted">{meta}</AppText></View></View>
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: 14, flexGrow: 1 }, topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topTitle: { position: 'absolute', left: 44, right: 44, textAlign: 'center' }, topSpacer: { width: 44, height: 44 }, loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' }, sections: { gap: 14 }, timeline: { gap: 12 }, event: { minHeight: 42, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dotHalo: { width: 18, height: 18, borderRadius: 9, borderCurve: 'continuous', marginTop: 0, alignItems: 'center', justifyContent: 'center' }, dot: { width: 10, height: 10, borderRadius: 5 }, eventCopy: { flex: 1, gap: 2 }, actions: { gap: 10 } })
