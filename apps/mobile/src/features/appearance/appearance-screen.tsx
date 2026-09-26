import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react-native'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppText } from '@/components/primitives/app-text'
import { IconButton } from '@/components/primitives/icon-button'
import { apiRequest, ApiError } from '@/lib/api-client'
import { useAppTheme } from '@/theme'
import { API_ROUTES, hexColorSchema, platformAppearanceSchema, type PlatformAppearance, type PlatformAppearanceSource } from '@tavvi/api-contracts'
import { PALETTE_SCHEMA_VERSION, contrastRatio, derivePlatformPalette, suggestOnAccent } from '@tavvi/theme-core'
import { appearanceQueryKey, fetchPlatformAppearance } from './appearance-query'

const swatches = ['#2563EB', '#7C3AED', '#DB2777', '#0F766E', '#EA580C', '#111827']

function normalizeColor(value: string) {
  const result = hexColorSchema.safeParse(value.trim())
  return result.success ? result.data : null
}

function ColorInput({ label, value, onChange, colors, invalid }: { label: string; value: string; onChange(value: string): void; colors: ReturnType<typeof useAppTheme>['colors']; invalid: boolean }) {
  return <View style={styles.fieldGroup}>
    <AppText variant="label" style={{ color: colors.foreground }}>{label}</AppText>
    <TextInput accessibilityLabel={`${label}, código hexadecimal`} value={value} onChangeText={onChange} autoCapitalize="characters" autoCorrect={false} maxLength={7} placeholder="#2563EB" placeholderTextColor={colors.subtle} style={[styles.hexInput, { color: colors.foreground, borderColor: invalid ? colors.dangerText : colors.line, backgroundColor: colors.field }]} />
  </View>
}

function Preview({ title, palette, dark }: { title: string; palette: Record<string, string>; dark: boolean }) {
  const background = dark ? '#11130F' : '#FFFFFF'
  const text = dark ? '#F4F6F0' : '#11150F'
  return <View style={[styles.preview, { backgroundColor: background, borderColor: dark ? '#30352C' : '#DEE2D5' }]}>
    <View style={styles.previewHeader}><AppText variant="label" style={{ color: text }}>{title}</AppText><View style={[styles.pill, { backgroundColor: palette['accent-pill'] }]}><AppText variant="badge" style={{ color: palette['accent-pill-on'] }}>Ativo</AppText></View></View>
    <View style={[styles.previewHero, { backgroundColor: dark ? '#181B15' : '#F5F7F1' }]}>
      <AppText variant="caps" style={{ color: dark ? palette['accent-text-dark'] : palette['accent-text-light'] }}>IDENTIDADE TAVVI</AppText>
      <AppText variant="rowTitle" style={{ color: text, fontSize: 17 }}>Seu painel, sua cor.</AppText>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.previewButton, { backgroundColor: pressed ? palette['accent-pressed'] : palette.accent, boxShadow: `0 8px 22px -10px ${palette['accent-cta-glow']}` }]}><Check size={15} color={palette['accent-on']} /><AppText variant="label" style={{ color: palette['accent-on'] }}>Ação principal</AppText></Pressable>
    </View>
    <View style={[styles.previewFoot, { backgroundColor: palette['accent-soft'] }]}><AppText variant="rowMeta" style={{ color: dark ? palette['accent-text-dark'] : palette['accent-text-light'] }}>Texto em destaque</AppText><View style={[styles.focusSample, { borderColor: palette['accent-focus'], boxShadow: `0 0 0 3px ${palette['accent-ring']}` }]}><AppText variant="badge" style={{ color: text }}>Foco</AppText></View></View>
  </View>
}

export function AppearanceScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { colors, appearance, setPlatformAppearance } = useAppTheme()
  const query = useQuery({ queryKey: appearanceQueryKey, queryFn: fetchPlatformAppearance, initialData: appearance, staleTime: 30_000 })
  const [accentDraft, setAccentDraft] = useState(appearance.source.brandAccent)
  const [foregroundDraft, setForegroundDraft] = useState(appearance.source.onAccentOverride ?? '#FFFFFF')
  const [customMode, setCustomMode] = useState(appearance.source.onAccentOverride !== null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'danger' | 'muted'>('muted')

  useEffect(() => {
    setAccentDraft(query.data.source.brandAccent)
    setForegroundDraft(query.data.source.onAccentOverride ?? '#FFFFFF')
    setCustomMode(query.data.source.onAccentOverride !== null)
  }, [query.data.updatedAt])

  const validAccent = normalizeColor(accentDraft)
  const validForeground = normalizeColor(foregroundDraft)
  const accent = validAccent ?? query.data.source.brandAccent
  const suggested = suggestOnAccent(accent)
  const onAccent = customMode && validForeground ? validForeground : suggested.color
  const contrast = contrastRatio(onAccent, accent)
  const source: PlatformAppearanceSource = { brandAccent: accent, onAccentOverride: customMode && validForeground ? validForeground : null }
  const preview = useMemo(() => derivePlatformPalette(source), [source.brandAccent, source.onAccentOverride])
  const invalid = !validAccent || (customMode && !validForeground)

  async function save() {
    if (invalid || saving) return
    setSaving(true)
    setMessage('')
    setMessageTone('muted')
    try {
      const raw = await apiRequest<unknown>(API_ROUTES.platform.appearance, { method: 'PATCH', body: JSON.stringify(source) })
      const parsed = platformAppearanceSchema.parse(raw)
      if (parsed.schemaVersion !== PALETTE_SCHEMA_VERSION) throw new Error('A versão da identidade visual não é compatível.')
      setPlatformAppearance(parsed)
      queryClient.setQueryData<PlatformAppearance>(appearanceQueryKey, parsed)
      setAccentDraft(parsed.source.brandAccent)
      setForegroundDraft(parsed.source.onAccentOverride ?? '#FFFFFF')
      setCustomMode(parsed.source.onAccentOverride !== null)
      setMessage('Identidade salva e aplicada.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Não foi possível salvar. Verifique a conexão e tente novamente.')
      setMessageTone('danger')
    } finally { setSaving(false) }
  }

  function resetDraft() {
    setAccentDraft('#2563EB')
    setForegroundDraft('#FFFFFF')
    setCustomMode(false)
    setMessage('Azul padrão selecionado. Salve para aplicar.')
    setMessageTone('muted')
  }

  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 126 }]}>
    <View style={styles.topBar}><IconButton icon={ArrowLeft} label="Voltar" onPress={() => router.back()} /><AppText variant="label" style={styles.topTitle}>Identidade visual</AppText><View style={styles.spacer} /></View>
    <View style={styles.heading}><AppText variant="titleLg">A cor do Tavvi</AppText><AppText variant="meta" tone="muted">Uma escolha atualiza os acentos dos painéis web e mobile.</AppText></View>
    {query.isError ? <AppText variant="rowMeta" style={{ color: colors.warningText }}>Sem conexão com a API. A prévia usa a última paleta disponível.</AppText> : null}
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <AppText variant="rowTitle">Cor de acento</AppText>
      <View style={styles.swatches}>{swatches.map((swatch) => <Pressable key={swatch} accessibilityRole="radio" accessibilityLabel={`Selecionar ${swatch}`} accessibilityState={{ selected: accent === swatch }} onPress={() => setAccentDraft(swatch)} style={[styles.swatch, { backgroundColor: swatch, borderColor: accent === swatch ? colors.foreground : colors.line }]} />)}</View>
      <ColorInput label="Acento hexadecimal" value={accentDraft} onChange={setAccentDraft} colors={colors} invalid={!validAccent} />
      {!validAccent ? <AppText variant="rowMeta" tone="danger">Use o formato #RRGGBB.</AppText> : null}
    </View>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <AppText variant="rowTitle">Texto sobre o acento</AppText>
      <AppText variant="rowMeta" tone="muted">Sugestão automática: {suggested.color}</AppText>
      <View style={styles.modeRow}>
        <ModeButton label="Automático" selected={!customMode} onPress={() => setCustomMode(false)} colors={colors} />
        <ModeButton label="Personalizado" selected={customMode} onPress={() => setCustomMode(true)} colors={colors} />
      </View>
      {customMode ? <>
        <ColorInput label="Texto hexadecimal" value={foregroundDraft} onChange={setForegroundDraft} colors={colors} invalid={!validForeground} />
        {!validForeground ? <AppText variant="rowMeta" tone="danger">Use o formato #RRGGBB.</AppText> : null}
      </> : null}
      {customMode ? <View style={styles.foregroundSwatches} accessibilityRole="radiogroup" accessibilityLabel="Cores sugeridas para o texto">
        {['#000000', '#FFFFFF', '#111827', '#F9FAFB'].map((swatch) => <Pressable key={swatch} accessibilityRole="radio" accessibilityLabel={`Selecionar texto ${swatch}`} accessibilityState={{ selected: validForeground === swatch }} onPress={() => setForegroundDraft(swatch)} style={[styles.swatch, { backgroundColor: swatch, borderColor: validForeground === swatch ? colors.accent : colors.line }]} />)}
      </View> : null}
      <View style={styles.contrastRow}><AppText variant="rowMeta" tone="muted">Contraste do texto</AppText><AppText variant="label" style={{ color: contrast < 4.5 ? colors.warningText : colors.foreground }}>{contrast.toFixed(2)}:1</AppText></View>
      {contrast < 4.5 ? <AppText variant="rowMeta" style={{ color: colors.warningText }}>Contraste abaixo de 4,5:1 para texto comum. A escolha personalizada pode ser salva.</AppText> : null}
    </View>
    <View style={styles.previewStack}><Preview title="Claro" palette={preview.light} dark={false} /><Preview title="Escuro" palette={preview.dark} dark /></View>
    {message ? <AppText variant="rowMeta" tone={messageTone === 'danger' ? 'danger' : 'muted'} style={messageTone === 'success' ? { color: colors.successText } : undefined} accessibilityRole="alert">{message}</AppText> : null}
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={resetDraft} disabled={saving} style={[styles.resetButton, { borderColor: colors.line, opacity: saving ? 0.5 : 1 }]}><RotateCcw size={16} color={colors.foreground} /><AppText variant="label">Restaurar azul</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || invalid, busy: saving }} onPress={() => void save()} disabled={saving || invalid} style={[styles.saveButton, { backgroundColor: colors.accent, opacity: saving || invalid ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color={colors.accentOn} /> : <Check size={17} color={colors.accentOn} />}<AppText variant="label" style={{ color: colors.accentOn }}>{saving ? 'Salvando…' : 'Salvar'}</AppText></Pressable>
    </View>
  </ScrollView>
}

function ModeButton({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress(): void; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.modeButton, { backgroundColor: selected ? colors.accentSurface : colors.field, borderColor: selected ? colors.accent : colors.line }]}><AppText variant="label" style={{ color: selected ? colors.accentText : colors.foreground }}>{label}</AppText></Pressable>
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 16 }, topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topTitle: { flex: 1, textAlign: 'center' }, spacer: { width: 44 },
  heading: { gap: 5, paddingTop: 4, paddingBottom: 2 }, card: { gap: 13, padding: 16, borderWidth: 1, borderRadius: 20, borderCurve: 'continuous' }, swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2 },
  fieldGroup: { gap: 7 }, hexInput: { minHeight: 48, borderWidth: 1, borderRadius: 13, borderCurve: 'continuous', paddingHorizontal: 13, fontFamily: 'JetBrainsMono_500Medium', fontSize: 13 }, modeRow: { flexDirection: 'row', gap: 8 }, modeButton: { minHeight: 42, borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 }, foregroundSwatches: { flexDirection: 'row', gap: 10 }, contrastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewStack: { gap: 12 }, preview: { gap: 12, padding: 14, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous' }, previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, previewHero: { gap: 8, padding: 14, borderRadius: 14, borderCurve: 'continuous' }, previewButton: { alignSelf: 'flex-start', minHeight: 40, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, previewFoot: { minHeight: 42, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, focusSample: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  actions: { flexDirection: 'row', gap: 9 }, resetButton: { minHeight: 48, flex: 1, borderWidth: 1, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, saveButton: { minHeight: 48, flex: 1, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
