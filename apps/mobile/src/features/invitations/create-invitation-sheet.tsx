import { BottomSheet, RNHostView } from '@expo/ui'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Mail, Minus, Plus } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from '@/components/primitives/app-text'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'
import { PrimaryCTA } from '@/components/primitives/primary-cta'
import type { PlatformInvitation } from '@tavvi/api-contracts'
import { radii, useAppTheme } from '@/theme'
import { useQueryClient } from '@tanstack/react-query'
import { invitationKeys, useCreateInvitation, useRotateInvitation } from './queries'

type CreatedLink = { id: string; link: string; copied: boolean }
export function CreateInvitationSheet({ open, onOpenChange, initialEmail = '', initialDays = 7, rotateInviteId, onComplete }: { open: boolean; onOpenChange(open: boolean): void; initialEmail?: string; initialDays?: number; rotateInviteId?: string; onComplete?(): void }) {
  const { colors } = useAppTheme(); const queryClient = useQueryClient()
  const [email, setEmail] = useState(initialEmail); const [days, setDays] = useState(initialDays); const [created, setCreated] = useState<CreatedLink | null>(null); const [emailError, setEmailError] = useState<string | null>(null); const [copyError, setCopyError] = useState<string | null>(null); const [emailFocused, setEmailFocused] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutation = useCreateInvitation((invite) => setCreated({ ...invite, copied: false }))
  const rotation = useRotateInvitation()
  const resetMutation = mutation.reset
  useEffect(() => { if (open) { setCreated(null); setEmail(initialEmail); setDays(initialDays); setEmailError(null); setCopyError(null); setEmailFocused(false); resetMutation(); rotation.reset() } }, [initialDays, initialEmail, open, resetMutation, rotation.reset])
  useEffect(() => () => { if (repeat.current) clearInterval(repeat.current) }, [])

  function reset() { setCreated(null); setEmail(initialEmail); setDays(initialDays); setEmailError(null); setCopyError(null); setEmailFocused(false); mutation.reset(); rotation.reset(); onOpenChange(false) }
  function dismiss() {
    if (mutation.isPending || rotation.isPending) {
      onOpenChange(true)
      return
    }
    if (created && !created.copied) {
      setConfirmDiscard(true)
      return
    }
    if (created) void queryClient.invalidateQueries({ queryKey: invitationKeys.all })
    reset()
  }
  function submit() {
    const validEmail = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim())
    setEmailError(validEmail ? null : 'Informe um e-mail válido ou deixe o campo vazio.')
    if (!validEmail) return
    if (rotateInviteId) rotation.mutate(rotateInviteId, { onSuccess: (invite) => {
      setCreated({ ...invite, copied: false })
      const revokedAt = new Date().toISOString()
      queryClient.setQueryData<PlatformInvitation[]>(invitationKeys.all, (items) => items?.map((item) => item.id === rotateInviteId ? { ...item, revokedAt } : item))
      queryClient.setQueryData<PlatformInvitation>([...invitationKeys.all, rotateInviteId], (item) => item ? { ...item, revokedAt } : item)
      void queryClient.invalidateQueries({ queryKey: invitationKeys.all })
    } })
    else mutation.mutate({ email: email.trim() || undefined, expiresInDays: days })
  }
  function updateDays(delta: number) { setDays((current) => Math.max(1, Math.min(30, current + delta))); void Haptics.selectionAsync() }
  function beginRepeat(delta: number) { if (repeat.current) clearInterval(repeat.current); repeat.current = setInterval(() => updateDays(delta), 130) }
  function endRepeat() { if (repeat.current) clearInterval(repeat.current); repeat.current = null }
  async function copyLink() {
    if (!created) return
    setCopyError(null)
    try {
      await Clipboard.setStringAsync(created.link)
      setCreated({ ...created, copied: true })
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      setCopyError('Não foi possível copiar. Pressione e segure o link para copiá-lo.')
    }
  }
  async function finish() { await queryClient.invalidateQueries({ queryKey: invitationKeys.all }); onComplete?.(); reset() }

  return <>
  <BottomSheet isPresented={open} onDismiss={dismiss} showDragIndicator={false} snapPoints={['half', 'full']} contentPadding={0} containerColor={colors.background}>
    <RNHostView>
    <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.line2 }]}>
      <View style={[styles.handle, { backgroundColor: colors.line2 }]} />
      <View style={styles.navigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancelar novo convite" accessibilityState={{ disabled: mutation.isPending || rotation.isPending }} disabled={mutation.isPending || rotation.isPending} onPress={dismiss} style={[styles.cancelAction, (mutation.isPending || rotation.isPending) && styles.disabledAction]}>
          <AppText variant="rowTitle" style={{ color: colors.goldText }}>Cancelar</AppText>
        </Pressable>
        <AppText variant="rowTitle" style={styles.navigationTitle}>Novo convite</AppText>
        <View style={styles.navigationSpacer} />
      </View>
      {created ? <View style={styles.createdContent}>
        <View style={styles.successHeading}><View style={[styles.successTile, { backgroundColor: colors.gold }]}><Check size={22} color={colors.goldInk} strokeWidth={2.4} /></View><View style={styles.successCopy}><AppText variant="title" style={{ color: colors.foreground }}>Convite criado</AppText><AppText variant="meta" tone="muted">Copie agora. O link não será exibido novamente.</AppText></View></View>
        <View style={[styles.linkBox, { backgroundColor: colors.field, borderColor: colors.line2 }]}><Text selectable textBreakStrategy="simple" style={[styles.linkText, { color: colors.foreground }]}>{created.link}</Text></View>
        <View style={[styles.warning, { backgroundColor: colors.warningSurface }]}><AppText variant="rowMeta" style={{ color: colors.warningText }}>Se fechar sem copiar, será necessário gerar outro convite.</AppText></View>
        {copyError ? <AppText variant="rowMeta" tone="danger" accessibilityRole="alert">{copyError}</AppText> : null}
        {copyError ? <Pressable accessibilityRole="button" onPress={() => { setCreated({ ...created, copied: true }); setCopyError(null) }} style={styles.manualCopy}><AppText variant="label" style={{ color: colors.goldText }}>Copiei manualmente</AppText></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => void copyLink()} style={({ pressed }) => [styles.copyLink, { backgroundColor: colors.field, borderColor: created.copied ? colors.goldText : colors.line2 }, pressed && { opacity: 0.75 }]}><Copy size={17} color={created.copied ? colors.goldText : colors.foreground} /><AppText variant="rowTitle" style={{ color: created.copied ? colors.goldText : colors.foreground }}>{created.copied ? 'Link copiado' : 'Copiar link'}</AppText></Pressable>
        <View style={styles.createdSpacer} />
        <PrimaryCTA label="Já copiei o link" icon={ArrowRight} disabled={!created.copied} onPress={() => void finish()} />
      </View> : <View style={styles.formStage}>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><AppText variant="meta" tone="muted">Crie um acesso de restaurante.</AppText></View>
        {mutation.isError || rotation.isError ? <AppText variant="rowMeta" tone="danger" accessibilityRole="alert">Não foi possível criar o convite. Tente novamente.</AppText> : null}
        <View style={styles.emailGroup}><View style={[styles.emailField, { backgroundColor: colors.field, borderColor: emailError ? colors.dangerText : emailFocused ? colors.goldText : colors.line }, emailFocused && !emailError ? { boxShadow: `0 0 0 4px ${colors.goldSoft}` } : null]}><Mail size={18} color={colors.subtle} /><TextInputField value={email} onChangeText={(value) => { setEmail(value); if (emailError) setEmailError(null) }} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} placeholder="E-mail (opcional)" placeholderColor={colors.subtle} disabled={Boolean(rotateInviteId)} /></View><AppText variant="rowMeta" style={{ color: colors.subtle }}>Preenchido, o link só funciona para quem entrar com esse e-mail.</AppText>{emailError ? <AppText variant="rowMeta" tone="danger" accessibilityRole="alert">{emailError}</AppText> : null}</View>
        <View style={styles.validity}><View style={[styles.stepper, { backgroundColor: colors.field, borderColor: colors.line }]}><AppText variant="label" style={{ color: colors.foreground }}>Validade</AppText><View style={styles.stepperValue}>
          <AppText variant="rowTitle" style={{ color: colors.foreground }}>{days === 1 ? '1 dia' : `${days} dias`}</AppText>
          <StepperButton label="Menos dias" disabled={Boolean(rotateInviteId) || days <= 1} icon={Minus} onPress={() => updateDays(-1)} onLongPress={() => beginRepeat(-1)} onPressOut={endRepeat} />
          <StepperButton label="Mais dias" disabled={Boolean(rotateInviteId) || days >= 30} icon={Plus} onPress={() => updateDays(1)} onLongPress={() => beginRepeat(1)} onPressOut={endRepeat} />
        </View></View><AppText variant="rowMeta" style={{ color: colors.subtle }}>Entre 1 e 30 dias. Quem aceitar dentro do prazo não perde o acesso depois.</AppText></View>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel={rotateInviteId ? 'Gerar novo link' : 'Gerar link'} accessibilityState={{ disabled: mutation.isPending || rotation.isPending, busy: mutation.isPending || rotation.isPending }} disabled={mutation.isPending || rotation.isPending} onPress={submit} style={({ pressed }) => [styles.generateButton, { backgroundColor: colors.button, opacity: mutation.isPending || rotation.isPending ? 0.6 : pressed ? 0.82 : 1 }]}>
          <AppText variant="rowTitle" style={{ color: colors.buttonText }}>{mutation.isPending || rotation.isPending ? 'Gerando…' : rotateInviteId ? 'Gerar novo link' : 'Gerar link'}</AppText>
          {mutation.isPending || rotation.isPending ? null : <ArrowRight size={17} color={colors.buttonText} strokeWidth={2} />}
        </Pressable>
      </View>}
    </View>
    </RNHostView>
  </BottomSheet>
  <ConfirmDialog
    visible={confirmDiscard}
    title="Descartar link?"
    description="Esse link é exibido uma única vez. Se você sair agora, ele deixará de ficar disponível nesta tela."
    confirmLabel="Descartar link"
    destructive
    onCancel={() => { setConfirmDiscard(false); onOpenChange(true) }}
    onConfirm={() => { setConfirmDiscard(false); void queryClient.invalidateQueries({ queryKey: invitationKeys.all }); reset() }}
  />
  </>
}

function TextInputField({ value, onChangeText, onFocus, onBlur, placeholder, placeholderColor, disabled }: { value: string; onChangeText(value: string): void; onFocus(): void; onBlur(): void; placeholder: string; placeholderColor: string; disabled?: boolean }) {
  const { colors } = useAppTheme()
  return <TextInput value={value} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur} editable={!disabled} placeholder={placeholder} placeholderTextColor={placeholderColor} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} accessibilityLabel="E-mail (opcional)" style={[styles.input, { color: colors.foreground, opacity: disabled ? 0.7 : 1 }]} />
}

function StepperButton({ label, icon: Icon, disabled, onPress, onLongPress, onPressOut }: { label: string; icon: LucideIcon; disabled: boolean; onPress(): void; onLongPress(): void; onPressOut(): void }) {
  const { colors } = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} hitSlop={4} disabled={disabled} onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={({ pressed }) => [styles.stepperButton, { backgroundColor: colors.surface, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Icon size={16} color={colors.foreground} strokeWidth={2} /></Pressable>
}

const styles = StyleSheet.create({
  sheet: { flex: 1, width: '100%', alignSelf: 'stretch', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderTopWidth: 1, overflow: 'hidden', paddingTop: 8, paddingHorizontal: 16, paddingBottom: 26, gap: 12, borderCurve: 'continuous' },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center' },
  navigation: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cancelAction: { minWidth: 72, height: 44, justifyContent: 'center' }, disabledAction: { opacity: 0.5 }, navigationTitle: { position: 'absolute', left: 72, right: 72, textAlign: 'center' }, navigationSpacer: { width: 72 }, manualCopy: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  formStage: { flex: 1, minHeight: 0, gap: 12 }, formScroll: { flex: 1, minHeight: 0 }, formContent: { width: '100%', alignSelf: 'stretch', gap: 16, paddingTop: 4, paddingBottom: 12 }, heading: { gap: 6, paddingHorizontal: 4 },
  emailGroup: { gap: 8 }, emailField: { minHeight: 54, borderWidth: 1, borderRadius: radii.field, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, input: { flex: 1, minWidth: 0, fontSize: 14.5, lineHeight: 20, paddingVertical: 0 },
  validity: { gap: 8 }, stepper: { minHeight: 54, borderWidth: 1, borderRadius: radii.field, borderCurve: 'continuous', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, stepperValue: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stepperButton: { width: 44, height: 44, borderRadius: radii.tileSm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, generateButton: { height: 52, flexShrink: 0, borderRadius: 999, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createdContent: { width: '100%', alignSelf: 'stretch', flex: 1, gap: 16, paddingTop: 4 }, createdSpacer: { flex: 1 }, successHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, successTile: { width: 46, height: 46, borderRadius: radii.tile, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' }, successCopy: { flex: 1, minWidth: 0, gap: 2 }, linkBox: { minHeight: 82, borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.field, borderCurve: 'continuous', padding: 14, justifyContent: 'center' }, linkText: { fontFamily: 'monospace', fontSize: 12.5, lineHeight: 19 }, warning: { padding: 12, borderRadius: radii.card, borderCurve: 'continuous' }, copyLink: { height: 54, borderWidth: 1, borderRadius: radii.control, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
