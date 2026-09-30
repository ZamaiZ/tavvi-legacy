import * as Haptics from 'expo-haptics'
import { Ban, ChevronLeft, Mail, RotateCcw } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { InviteState } from './queries'
import { useInvitation, useRevokeInvitation } from './queries'
import { getInviteState } from './invitation-state'
import { AppText } from '@/components/primitives/app-text'
import { DetailHero } from '@/components/primitives/detail-hero'
import { DetailSkeleton } from '@/components/primitives/detail-skeleton'
import { SecondaryCTA } from '@/components/primitives/secondary-cta'
import { StateCard } from '@/components/primitives/state-card'
import { toast } from '@/components/primitives/toast'
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
  const events = invite && state ? [
    { title: 'Criado', meta: `${formatDate(invite.createdAt)} · por ${invite.createdByEmail}`, tone: 'neutral' as const },
    ...(state === 'redeemed' ? [{ title: 'Resgatado', meta: `${formatDate(invite.redeemedAt!)} · ${invite.redeemedByEmail ?? invite.email ?? 'Administrador'}`, tone: 'success' as const }] : []),
    ...(state === 'revoked' ? [{ title: 'Revogado', meta: formatDate(invite.revokedAt!), tone: 'danger' as const }] : []),
    ...(state === 'expired' ? [{ title: 'Venceu', meta: formatDate(invite.expiresAt), tone: 'warning' as const }] : []),
    ...(state === 'pending' ? [{ title: 'Aguardando resgate', meta: `Válido até ${formatDate(invite.expiresAt)}`, tone: 'accent' as const }] : []),
  ] : []

  async function confirmRevoke() {
    if (!invite) return
    revoke.mutate(invite.id, { onSuccess: () => { setDialog(false); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); toast.show('Convite revogado') } })
  }
  const body = query.isLoading ? <DetailSkeleton kind="invitation" />
    : query.isError || !invite || !state ? <StateCard error title="Não foi possível carregar" message="Verifique sua conexão e tente novamente." retry actionLabel="Tentar novamente" actionIcon={RotateCcw} onAction={() => void query.refetch()} />
      : <View style={styles.sections}>
        <DetailHero icon={Mail} status={labels[state].status} tone={labels[state].tone} title={invite.email || 'Qualquer e-mail'} meta={labels[state].meta(formatDate(state === 'redeemed' ? invite.redeemedAt! : state === 'revoked' ? invite.revokedAt! : invite.expiresAt))} />
        <View style={styles.historySection}>
          <AppText variant="caps" style={[styles.sectionLabel, { color: colors.subtle }]}>HISTÓRICO</AppText>
          <View style={[styles.timelineCard, { backgroundColor: colors.surface }]}><View style={styles.timeline}>
          {events.map((event, index) => <TimelineEvent key={`${event.title}-${index}`} title={event.title} meta={event.meta} tone={event.tone} last={index === events.length - 1} />)}
          </View></View>
        </View>
        <View style={styles.actions}>
          {state === 'pending' ? <><TonalButton label="Gerar novo link" icon={RotateCcw} variant="primary" onPress={() => setSheet(true)} /><TonalButton label="Revogar convite" icon={Ban} variant="danger" onPress={() => setDialog(true)} /></>
            : <SecondaryCTA label="Gerar novo convite" icon={RotateCcw} onPress={() => setSheet(true)} />}
        </View>
      </View>

  return <>
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + layout.contentTop, paddingBottom: layout.contentBottom + insets.bottom }]}>
      <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Voltar para convites" onPress={() => router.back()} style={styles.backAction}><ChevronLeft size={24} color={colors.goldText} strokeWidth={2.1} /><AppText variant="rowTitle" style={{ color: colors.goldText }}>Convites</AppText></Pressable><AppText variant="label" style={styles.topTitle}>Convite</AppText><View style={styles.topSpacer} /></View>
      {body}
    </ScrollView>
    <RevokeDialog visible={dialog} loading={revoke.isPending} onCancel={() => setDialog(false)} onConfirm={() => void confirmRevoke()} />
    <CreateInvitationSheet open={sheet} onOpenChange={setSheet} initialEmail={invite?.email ?? ''} initialDays={state === 'pending' ? remainingDays : 7} rotateInviteId={state === 'pending' ? invite?.id : undefined} />
  </>
}

function TimelineEvent({ title, meta, tone, last }: { title: string; meta: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'; last: boolean }) {
  const { colors } = useAppTheme()
  const palette = { neutral: colors.neutralText, success: colors.successText, warning: colors.warningText, danger: colors.dangerText, accent: colors.goldText } as const
  const color = palette[tone]
  return <View style={styles.event}><View style={styles.rail}><View style={[styles.dot, { backgroundColor: color }]} />{!last ? <View style={[styles.connector, { backgroundColor: colors.line2 }]} /> : null}</View><View style={styles.eventCopy}><AppText variant="bodyMedium" style={{ color: colors.foreground }}>{title}</AppText><AppText variant="rowMeta" tone="muted">{meta}</AppText></View></View>
}

const styles = StyleSheet.create({ content: { paddingHorizontal: layout.screenHorizontal, gap: 14, flexGrow: 1 }, topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 0, paddingRight: 12 }, topTitle: { position: 'absolute', left: 44, right: 44, textAlign: 'center' }, topSpacer: { width: 44, height: 44 }, sections: { gap: 14 }, historySection: { gap: 6 }, sectionLabel: { paddingLeft: 14 }, timelineCard: { borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 }, timeline: { gap: 0 }, event: { minHeight: 46, flexDirection: 'row', alignItems: 'stretch', gap: 12 }, rail: { width: 8, alignItems: 'center', paddingTop: 5 }, dot: { width: 8, height: 8, borderRadius: 4 }, connector: { width: 1, flex: 1, marginTop: 3 }, eventCopy: { flex: 1, gap: 2, paddingBottom: 12 }, actions: { gap: 10, marginTop: 4 } })
