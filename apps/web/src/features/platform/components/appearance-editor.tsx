'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { contrastRatio, derivePlatformPalette, suggestOnAccent } from '@tavvi/theme-core'
import { hexColorSchema, type PlatformAppearance, type PlatformAppearanceSource } from '@tavvi/api-contracts'
import { updatePlatformAppearanceAction } from '@/features/platform/actions/appearance'
import { usePlatformAppearance } from '@/components/theme/platform-appearance-provider'

const DEFAULT_ACCENT = '#2563EB'

function parseColor(value: string) {
  const parsed = hexColorSchema.safeParse(value.trim())
  return parsed.success ? parsed.data : null
}

function ColorField({ label, value, invalid, onChange }: { label: string; value: string; invalid?: boolean; onChange(value: string): void }) {
  const selected = parseColor(value) ?? DEFAULT_ACCENT
  return <label className="tv-branding-field">
    <span>{label}</span>
    <span className="tv-branding-color-row">
      <input aria-label={`${label}, seletor de cor`} type="color" value={selected} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value.toUpperCase())} />
      <input aria-label={`${label}, código hexadecimal`} inputMode="text" autoComplete="off" spellCheck={false} value={value} aria-invalid={invalid || undefined} onChange={(event) => onChange(event.target.value)} />
    </span>
  </label>
}

function PreviewCard({ title, palette, dark }: { title: string; palette: Record<string, string>; dark: boolean }) {
  const foreground = palette['accent-on']
  const panel = dark ? '#11130F' : '#FFFFFF'
  const text = dark ? '#F4F6F0' : '#11150F'
  return <section className={`tv-branding-preview ${dark ? 'is-dark' : 'is-light'}`} style={{ background: panel, color: text }} aria-label={`Prévia no tema ${title}`}>
    <div className="tv-branding-preview-head"><span>{title}</span><span className="tv-branding-pill" style={{ background: palette['accent-pill'], color: palette['accent-pill-on'] }}>Ativo</span></div>
    <div className="tv-branding-preview-hero" style={{ background: `radial-gradient(70% 100% at 100% 100%, ${palette['accent-hero-glow']}, transparent 75%), ${dark ? '#181B15' : '#F5F7F1'}` }}>
      <small style={{ color: dark ? palette['accent-text-dark'] : palette['accent-text-light'] }}>IDENTIDADE TAVVI</small>
      <strong>Seu painel, sua cor.</strong>
      <button type="button" style={{ background: palette.accent, color: foreground, boxShadow: `0 10px 28px -10px ${palette['accent-cta-glow']}` }}>Ação principal</button>
      <button type="button" className="tv-branding-pressed" style={{ background: palette['accent-pressed'], color: foreground }}>Pressionado</button>
    </div>
    <div className="tv-branding-preview-foot" style={{ background: palette['accent-soft'] }}>
      <span style={{ color: dark ? palette['accent-text-dark'] : palette['accent-text-light'] }}>Texto de destaque</span>
      <span className="tv-branding-focus" style={{ outlineColor: palette['accent-focus'], boxShadow: `0 0 0 4px ${palette['accent-ring']}` }}>Foco e anel</span>
    </div>
  </section>
}

export function AppearanceEditor({ initialAppearance }: { initialAppearance: PlatformAppearance }) {
  const { applyAppearance } = usePlatformAppearance()
  const [accentDraft, setAccentDraft] = useState(initialAppearance.source.brandAccent)
  const [customDraft, setCustomDraft] = useState(initialAppearance.source.onAccentOverride ?? '#FFFFFF')
  const [customMode, setCustomMode] = useState(initialAppearance.source.onAccentOverride !== null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const validAccent = parseColor(accentDraft)
  const validCustom = parseColor(customDraft)
  const accent = validAccent ?? initialAppearance.source.brandAccent
  const suggestion = suggestOnAccent(accent)
  const onAccent = customMode && validCustom ? validCustom : suggestion.color
  const contrast = contrastRatio(onAccent, accent)
  const source: PlatformAppearanceSource = { brandAccent: accent, onAccentOverride: customMode && validCustom ? validCustom : null }
  const previewPalette = useMemo(() => derivePlatformPalette(source), [source.brandAccent, source.onAccentOverride])
  const invalid = !validAccent || (customMode && !validCustom)

  async function save() {
    if (invalid || saving) return
    setSaving(true)
    setMessage('')
    setMessageIsError(false)
    try {
      const result = await updatePlatformAppearanceAction(source)
      if (result.ok) {
        applyAppearance(result.data)
        setAccentDraft(result.data.source.brandAccent)
        setCustomDraft(result.data.source.onAccentOverride ?? '#FFFFFF')
        setCustomMode(result.data.source.onAccentOverride !== null)
        setMessage('Identidade visual salva e aplicada.')
      } else {
        setMessage(result.error)
        setMessageIsError(true)
      }
    } catch {
      setMessage('Não foi possível salvar. Verifique a conexão e tente novamente.')
      setMessageIsError(true)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setAccentDraft(DEFAULT_ACCENT)
    setCustomDraft('#FFFFFF')
    setCustomMode(false)
    setMessageIsError(false)
    setMessage('Padrão azul selecionado. Salve para aplicar.')
  }

  return <div className="tv-branding-editor">
    <div className="tv-branding-controls">
      <div>
        <h2>Cor de acento</h2>
        <p>Uma única escolha atualiza os tons derivados do painel web e mobile.</p>
        <ColorField label="Acento" value={accentDraft} invalid={!validAccent} onChange={setAccentDraft} />
        {!validAccent ? <small className="tv-branding-error">Use o formato hexadecimal #RRGGBB.</small> : null}
      </div>
      <div>
        <h2>Texto sobre o acento</h2>
        <p>A sugestão considera o contraste. Você pode escolher outra cor quando necessário.</p>
        <div className="tv-branding-mode" role="group" aria-label="Modo de cor do texto">
          <button type="button" aria-pressed={!customMode} onClick={() => setCustomMode(false)}>Automático <span>{suggestion.color}</span></button>
          <button type="button" aria-pressed={customMode} onClick={() => setCustomMode(true)}>Personalizado</button>
        </div>
        {customMode ? <>
          <ColorField label="Texto do acento" value={customDraft} invalid={!validCustom} onChange={setCustomDraft} />
          {!validCustom ? <small className="tv-branding-error">Use o formato hexadecimal #RRGGBB.</small> : null}
        </> : null}
        <div className={`tv-branding-contrast ${contrast < 4.5 ? 'is-warning' : ''}`}>
          <span>Contraste</span><strong>{contrast.toFixed(2)}:1</strong>
          {contrast < 4.5 ? <small>Contraste abaixo de 4,5:1 para texto comum.</small> : <small>Boa leitura para texto comum.</small>}
        </div>
      </div>
    </div>
    <div className="tv-branding-preview-grid">
      <PreviewCard title="Claro" palette={previewPalette.light} dark={false} />
      <PreviewCard title="Escuro" palette={previewPalette.dark} dark />
    </div>
    <footer className="tv-branding-actions">
      <span role="status" className={messageIsError ? 'is-error' : undefined}>{saving ? 'Salvando…' : message}</span>
      <button type="button" className="tv-branding-reset" onClick={reset} disabled={saving}>Restaurar azul padrão</button>
      <button type="button" className="tv-branding-save" onClick={() => void save()} disabled={saving || invalid}>{saving ? 'Salvando…' : 'Salvar identidade'}</button>
    </footer>
  </div>
}
