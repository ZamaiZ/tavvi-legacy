import { BottomSheet } from '@expo/ui'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Mail, Minus, Plus } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { AppText } from '@/components/primitives/app-text'
import { PrimaryCTA } from '@/components/primitives/primary-cta'
import type { PlatformInvitation } from '@tavvi/api-contracts'
import { brand, radii, useAppTheme } from '@/theme'
import { useQueryClient } from '@tanstack/react-query'
import { invitationKeys, useCreateInvitation, useRotateInvitation } from './queries'

type CreatedLink = { id: string; link: string; copied: boolean }
export function CreateInvitationSheet({ open, onOpenChange, initialEmail = '', initialDays = 7, rotateInviteId, onComplete }: { open: boolean; onOpenChange(open: boolean): void; initialEmail?: string; initialDays?: number; rotateInviteId?: string; onComplete?(): void }) {
  const { colors } = useAppTheme(); const queryClient = useQueryClient()
  const [email, setEmail] = useState(initialEmail); const [days, setDays] = useState(initialDays); const [created, setCreated] = useState<CreatedLink | null>(null); const [emailError, setEmailError] = useState<string | null>(null); const [emailFocused, setEmailFocused] = useState(false)
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutation = useCreateInvitation((invite) => setCreated({ ...invite, copied: false }))
  const rotation = useRotateInvitation()
  const resetMutation = mutation.reset
  useEffect(() => { if (open) { setCreated(null); setEmail(initialEmail); setDays(initialDays); setEmailError(null); setEmailFocused(false); resetMutation(); rotation.reset() } }, [initialDays, initialEmail, open, resetMutation, rotation.reset])
  useEffect(() => () => { if (repeat.current) clearInterval(repeat.current) }, [])

  function reset() { setCreated(null); setEmail(initialEmail); setDays(initialDays); setEmailError(null); setEmailFocused(false); mutation.reset(); rotation.reset(); onOpenChange(false) }
  function dismiss() {
    if (created && !created.copied) {
      Alert.alert('Descartar link?', 'Esse link é exibido uma única vez.', [{ text: 'Voltar ao link', onPress: () => onOpenChange(true) }, { text: 'Descartar', style: 'destructive', onPress: () => { void queryClient.invalidateQueries({ queryKey: invitationKeys.all }); reset() } }])
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
    await Clipboard.setStringAsync(created.link)
    setCreated({ ...created, copied: true })
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }
  async function finish() { await queryClient.invalidateQueries({ queryKey: invitationKeys.all }); onComplete?.(); reset() }

  return <BottomSheet isPresented={open} onDismiss={dismiss} showDragIndicator={false} snapPoints={['half', 'full']} containerColor={colors.surface}>
    <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      <View style={[styles.handle, { backgroundColor: colors.line2 }]} />
      {created ? <View style={styles.createdContent}>
        <View style={styles.successHeading}><View style={styles.successTile}><Check size={22} color={brand.ink} strokeWidth={2.4} /></View><View style={styles.successCopy}><AppText variant="title" style={{ color: colors.foreground }}>Convite criado</AppText><AppText variant="meta" tone="muted">Copie agora. O link não será exibido novamente.</AppText></View></View>
        <View style={[styles.linkBox, { backgroundColor: colors.field, borderColor: colors.line2 }]}><Text selectable textBreakStrategy="simple" style={[styles.linkText, { color: colors.foreground }]}>{created.link}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => void copyLink()} style={({ pressed }) => [styles.copyLink, { backgroundColor: colors.field, borderColor: created.copied ? colors.accentText : colors.line2 }, pressed && { opacity: 0.75 }]}><Copy size={17} color={created.copied ? colors.accentText : colors.foreground} /><AppText variant="rowTitle" style={{ color: created.copied ? colors.accentText : colors.foreground }}>{created.copied ? 'Link copiado' : 'Copiar link'}</AppText></Pressable>
        <PrimaryCTA label="Já copiei o link" icon={ArrowRight} disabled={!created.copied} onPress={() => void finish()} />
      </View> : <View style={styles.formContent}>
        <View style={styles.heading}><AppText variant="title" style={{ color: colors.foreground }}>Novo convite<AppText variant="title" style={{ color: colors.accentText }}>.</AppText></AppText><AppText variant="meta" tone="muted">Crie um acesso de administrador da plataforma.</AppText></View>
        {mutation.isError || rotation.isError ? <AppText variant="rowMeta" tone="danger" accessibilityRole="alert">Não foi possível criar o convite. Tente novamente.</AppText> : null}
        <View style={styles.emailGroup}><AppText variant="label" tone="muted">E-mail (opcional)</AppText><View style={[styles.emailField, { backgroundColor: colors.field, borderColor: emailError ? colors.dangerText : emailFocused ? colors.accentText : colors.line }, emailFocused && !emailError ? { boxShadow: `0 0 0 4px ${colors.accentSurface}` } : null]}><Mail size={18} color={colors.subtle} /><TextInputField value={email} onChangeText={(value) => { setEmail(value); if (emailError) setEmailError(null) }} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} placeholder="Qualquer e-mail" placeholderColor={colors.subtle} disabled={Boolean(rotateInviteId)} /></View>{emailError ? <AppText variant="rowMeta" tone="danger">{emailError}</AppText> : null}</View>
        <View style={styles.validity}><AppText variant="label" tone="muted">Validade</AppText><View style={[styles.stepper, { backgroundColor: colors.field, borderColor: colors.line }]}>
          <StepperButton label="Menos dias" disabled={Boolean(rotateInviteId) || days <= 1} icon={Minus} onPress={() => updateDays(-1)} onLongPress={() => beginRepeat(-1)} onPressOut={endRepeat} />
          <AppText variant="rowTitle" style={{ color: colors.foreground }}>{rotateInviteId ? `Validade: ${days === 1 ? '1 dia' : `${days} dias`}` : days === 1 ? '1 dia' : `${days} dias`}</AppText>
          <StepperButton label="Mais dias" disabled={Boolean(rotateInviteId) || days >= 30} icon={Plus} onPress={() => updateDays(1)} onLongPress={() => beginRepeat(1)} onPressOut={endRepeat} />
        </View><AppText variant="rowMeta" style={{ color: colors.subtle }}>Escolha entre 1 e 30 dias.</AppText></View>
        <PrimaryCTA label={rotateInviteId ? 'Gerar novo link' : 'Gerar link'} loading={mutation.isPending || rotation.isPending} loadingLabel="Gerando…" disabled={mutation.isPending || rotation.isPending} icon={ArrowRight} onPress={submit} />
      </View>}
    </View>
  </BottomSheet>
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
  sheet: { flex: 1, width: '100%', alignSelf: 'stretch', borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, borderTopWidth: 1, overflow: 'hidden', paddingTop: 10, paddingHorizontal: 18, paddingBottom: 34, gap: 16, borderCurve: 'continuous' },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 0 },
  formContent: { width: '100%', alignSelf: 'stretch', gap: 16, paddingTop: 4 }, heading: { gap: 6, paddingHorizontal: 4 },
  emailGroup: { gap: 8 }, emailField: { minHeight: 54, borderWidth: 1, borderRadius: radii.field, borderCurve: 'continuous', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, input: { flex: 1, minWidth: 0, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14.5, lineHeight: 20, paddingVertical: 0 },
  validity: { gap: 8 }, stepper: { height: 54, borderWidth: 1, borderRadius: radii.field, borderCurve: 'continuous', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, stepperButton: { width: 40, height: 40, borderRadius: radii.tileSm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  createdContent: { width: '100%', alignSelf: 'stretch', flex: 1, gap: 16, paddingTop: 4 }, successHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, successTile: { width: 46, height: 46, borderRadius: radii.tile, borderCurve: 'continuous', backgroundColor: brand.lime, alignItems: 'center', justifyContent: 'center' }, successCopy: { flex: 1, minWidth: 0, gap: 2 }, linkBox: { minHeight: 82, borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.field, borderCurve: 'continuous', padding: 14, justifyContent: 'center' }, linkText: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12.5, lineHeight: 19 }, copyLink: { height: 54, borderWidth: 1, borderRadius: radii.control, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
