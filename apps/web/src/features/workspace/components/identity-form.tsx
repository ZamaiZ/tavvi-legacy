'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LuCheck, LuUndo2 } from 'react-icons/lu'
import {
  BrandImages,
  brandChanged,
  brandPreviewPath,
  commitBrandImage,
  revokeBrandPreview,
  type BrandDraft,
} from '@/features/workspace/components/brand-images'
import { FloatingRestaurantPreview } from '@/features/workspace/components/floating-restaurant-preview'
import { IdentityPreview } from '@/features/workspace/components/identity-preview'
import { ThemePreview } from '@/features/workspace/components/theme-preview'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { BrandSlot } from '@/domain/media'
import { SORTED_SEGMENTS, suggestPresetFor } from '@/domain/segment'
import {
  THEME_PRESET_IDS,
  themeSchema,
  type Density,
  type ThemeChoice,
  type ThemePresetId,
} from '@/domain/theme'
import { contrastRatio, fitContrast } from '@/lib/color'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { isBaseInRange, PRESETS } from '@/lib/theme/presets'
import { CONTRAST_MINIMUMS } from '@/lib/theme/resolve'
import {
  getAccentOptions,
  getBaseOptions,
  isAccentUsable,
} from '@/features/workspace/components/identity-theme-options'
import { updateIdentityAction } from '@/server/actions/restaurants'

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'confortavel', label: 'Confortável' },
  { value: 'compacto', label: 'Compacto' },
]

const BRAND_SLOTS: BrandSlot[] = ['logo', 'cover']

// "Não informar" é o valor vazio, gravado como null.
const SEGMENT_OPTIONS: ComboboxOption[] = [
  { value: '', label: 'Não informar' },
  ...SORTED_SEGMENTS.map((segment) => ({ value: segment.label, label: segment.label })),
]

function sameColor(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}

export function IdentityForm({
  restaurantId,
  name,
  segment,
  theme,
  logoPath,
  coverPath,
  continueLabel,
  busy,
  onSaved,
}: {
  restaurantId: string
  name: string
  segment: string | null
  theme: unknown
  logoPath: string | null
  coverPath: string | null
  /** Assistente: o botão vira "Salvar e continuar" e, sem mudanças, só continua. */
  continueLabel?: string
  /** Algo fora do formulário está rodando (o assistente navegando). */
  busy?: boolean
  /** O assistente usa isto para avançar de passo; a tela solta não passa. */
  onSaved?: () => void
}) {
  const initialChoice = themeSchema.safeParse(theme ?? {})
  const [choice, setChoice] = useState<ThemeChoice>(
    initialChoice.success
      ? initialChoice.data
      : { preset: 'grao', base: null, accent: null, density: 'confortavel' },
  )
  const [savedChoice, setSavedChoice] = useState(choice)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(segment)
  const [savedSegment, setSavedSegment] = useState(segment)
  const [themeTouched, setThemeTouched] = useState(false)
  // Logo e capa em rascunho: o arquivo escolhido aparece na prévia e só sobe
  // no "Salvar identidade", como o resto da tela.
  const [savedBrand, setSavedBrand] = useState<Record<BrandSlot, string | null>>({ logo: logoPath, cover: coverPath })
  const [brand, setBrand] = useState<Record<BrandSlot, BrandDraft>>({
    logo: { kind: 'saved', path: logoPath },
    cover: { kind: 'saved', path: coverPath },
  })
  const brandRef = useRef(brand)
  useEffect(() => {
    brandRef.current = brand
  })
  useEffect(() => () => {
    revokeBrandPreview(brandRef.current.logo)
    revokeBrandPreview(brandRef.current.cover)
  }, [])
  const [pending, startTransition] = useTransition()
  const locked = pending || busy === true

  const preset = PRESETS[choice.preset]
  const currentBase = choice.base ?? preset.light.base
  const currentAccent = choice.accent ?? preset.light.accent
  const suggestedPreset = suggestPresetFor(selectedSegment)
  const baseOptions = useMemo(
    () => getBaseOptions(choice.preset, currentBase),
    [choice.preset, currentBase],
  )
  const accentOptions = useMemo(
    () => getAccentOptions(choice.preset, currentBase, currentAccent),
    [choice.preset, currentBase, currentAccent],
  )

  // As conferências do servidor, repetidas aqui — a regra é o
  // `updateIdentity`, que roda de novo e recusa. Mas dizer "não passa" no
  // momento da escolha é muito melhor que dizer ao salvar.
  const isBaseValid = isBaseInRange(choice.preset, currentBase)
  // Destaque do tema (`accent: null`): o cardápio usa a cor calibrada do
  // preset no escuro, e no claro só precisa alcançar o piso. Destaque do
  // dono: tem de ser legível como está no claro — é o que ele vê e escolheu —
  // e ter versão possível no escuro. Nenhuma derivação escondida no claro.
  const accentReadsOnLight =
    choice.accent === null
      ? fitContrast(currentAccent, currentBase, CONTRAST_MINIMUMS.accent) !== null
      : contrastRatio(currentAccent, currentBase) >= CONTRAST_MINIMUMS.accent
  const isAccentValid =
    choice.accent === null ? accentReadsOnLight : isAccentUsable(choice.preset, currentAccent, currentBase)
  const themeChanged = JSON.stringify(choice) !== JSON.stringify(savedChoice) || selectedSegment !== savedSegment
  const brandDirty = BRAND_SLOTS.some((slot) => brandChanged(brand[slot], savedBrand[slot]))
  const hasChanges = themeChanged || brandDirty
  const canSave = !locked && hasChanges && isBaseValid && isAccentValid
  const canContinue = !locked && !hasChanges && Boolean(continueLabel)

  function updateSegment(value: string) {
    const nextSegment = value === '' ? null : value
    setSelectedSegment(nextSegment)

    // Sugere o tema, e só enquanto a pessoa não tiver escolhido um à mão.
    // Depois disso a escolha é dela, e sobrescrever seria desfazer decisão.
    if (!themeTouched) {
      // Trocar de tema zera as cores pelo mesmo motivo de `updatePreset`;
      // continuar no mesmo tema mantém as que o dono já escolheu.
      const suggested = suggestPresetFor(nextSegment)
      if (suggested) {
        setChoice((current) =>
          current.preset === suggested ? current : { ...current, preset: suggested, base: null, accent: null },
        )
      }
    }
  }

  function updatePreset(id: ThemePresetId) {
    setThemeTouched(true)
    // As cores voltam ao padrão do preset novo: um fundo escolhido dentro da
    // faixa do Grão quase nunca está dentro da faixa do Brasa, e carregar a
    // cor antiga produziria um estado recusado já no primeiro render.
    setChoice((current) => ({ ...current, preset: id, base: null, accent: null }))
  }

  function save() {
    if (locked) return
    if (canContinue) {
      onSaved?.()
      return
    }
    if (!canSave) return
    const choiceToSave = choice
    const segmentToSave = selectedSegment
    const brandToSave = brand
    startTransition(async () => {
      // Logo e capa primeiro: são arquivos, e a falha mais provável (rede)
      // aparece antes de gravar o tema. Cada um vale sozinho no banco.
      const nextSaved = { ...savedBrand }
      for (const slot of BRAND_SLOTS) {
        if (!brandChanged(brandToSave[slot], savedBrand[slot])) continue
        const result = await commitBrandImage(restaurantId, slot, brandToSave[slot], savedBrand[slot])
        if (!result.ok) {
          setSavedBrand(nextSaved)
          toast.add({ title: result.error, type: 'error' })
          return
        }
        revokeBrandPreview(brandToSave[slot])
        nextSaved[slot] = result.path
        setBrand((current) => ({ ...current, [slot]: { kind: 'saved', path: result.path } }))
      }
      setSavedBrand(nextSaved)

      if (themeChanged) {
        const result = await updateIdentityAction({
          restaurantId,
          segment: segmentToSave,
          theme: choiceToSave,
        })
        if (!result.ok) {
          toast.add({ title: result.error, type: 'error' })
          return
        }
        setSavedChoice(choiceToSave)
        setSavedSegment(segmentToSave)
      }
      toast.add({ title: 'Identidade salva', type: 'success' })
      onSaved?.()
    })
  }

  const previewData = {
    theme: choice,
    name,
    segment: selectedSegment,
    logoPath: brandPreviewPath(brand.logo),
    coverPath: brandPreviewPath(brand.cover),
  }

  return (
    <div className="tv-identity-layout">
      <div className="tv-identity-main">
        <BrandImages
          drafts={brand}
          disabled={locked}
          onChange={(slot, draft) => setBrand((current) => ({ ...current, [slot]: draft }))}
        />

        <section className="tv-identity-card is-theme" aria-label="Tema e cores" aria-busy={locked || undefined}>
          <div className="tv-identity-field is-segment">
            <span className="tv-identity-label">Tipo de restaurante</span>
            <Combobox
              label="Tipo de restaurante"
              options={SEGMENT_OPTIONS}
              value={selectedSegment ?? ''}
              onValueChange={updateSegment}
              disabled={locked}
              className="tv-identity-combo"
            />
            <span className="tv-identity-help">Só serve para sugerir um tema. Você pode trocar o tema depois.</span>
          </div>

          <div className="tv-identity-field is-themes">
            <span id="identity-theme-label" className="tv-identity-label">Tema do cardápio</span>
            {/* As variáveis das fontes dos temas, para cada "Aa" sair na fonte do
                próprio tema, e não na do painel. */}
            <div className={`tv-identity-themes ${ALL_THEME_FONT_VARIABLES}`} role="group" aria-labelledby="identity-theme-label">
              {THEME_PRESET_IDS.map((id) => {
                const p = PRESETS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    className="tv-identity-theme"
                    aria-pressed={choice.preset === id}
                    disabled={locked}
                    onClick={() => updatePreset(id)}
                  >
                    <span className="tv-identity-theme-swatches" aria-hidden="true">
                      {[p.light.base, p.light.accent, p.dark.base].map((color, i) => (
                        <i key={i} style={{ background: color }} />
                      ))}
                    </span>
                    <span aria-hidden="true" className="tv-identity-theme-sample" style={{ color: p.light.accent, fontFamily: p.displayFont }}>Aa</span>
                    <span className="tv-identity-theme-name">
                      <strong>{p.label}</strong>
                      {suggestedPreset === id ? <small>SUGERIDO</small> : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <span className="tv-identity-help">{preset.segments.slice(0, 5).join(' · ')}</span>
          </div>

          <div className="tv-identity-colors">
            <div className="tv-identity-field">
              <span id="identity-base-label" className="tv-identity-label">Cor de fundo</span>
              <div className="tv-identity-swatches" role="group" aria-labelledby="identity-base-label">
                {baseOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Cor de fundo ${color}`}
                    aria-pressed={sameColor(currentBase, color)}
                    disabled={locked}
                    onClick={() => setChoice((current) => ({ ...current, base: sameColor(color, preset.light.base) ? null : color }))}
                    style={{ background: color }}
                  />
                ))}
              </div>
              {isBaseValid ? (
                <span className="tv-identity-help is-mono">{currentBase} · Dentro da faixa deste tema.</span>
              ) : (
                <span className="tv-identity-error">
                  Fora da faixa do tema {preset.label}. O cardápio ficaria ilegível, e o servidor vai recusar.
                </span>
              )}
            </div>

            <div className="tv-identity-field">
              <span id="identity-accent-label" className="tv-identity-label">Cor de destaque</span>
              <div className="tv-identity-swatches" role="group" aria-labelledby="identity-accent-label">
                {accentOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Cor de destaque ${color}`}
                    aria-pressed={sameColor(currentAccent, color)}
                    disabled={locked}
                    onClick={() => setChoice((current) => ({ ...current, accent: sameColor(color, preset.light.accent) ? null : color }))}
                    style={{ background: color }}
                  />
                ))}
              </div>
              {isAccentValid ? (
                <span className="tv-identity-help"><span className="is-mono">{currentAccent}</span> · O matiz é mantido nas duas versões do cardápio.</span>
              ) : (
                <span className="tv-identity-error">
                  {accentReadsOnLight
                    ? 'Não fica legível na versão escura do cardápio. Escolha outra cor de destaque.'
                    : 'Pouco contraste com este fundo. Escolha outra cor de destaque.'}
                </span>
              )}
            </div>
          </div>

          <div className="tv-identity-field">
            <span id="identity-density-label" className="tv-identity-label">Densidade</span>
            <div className="tv-identity-segmented" role="group" aria-labelledby="identity-density-label">
              {DENSITIES.map((density) => (
                <button
                  key={density.value}
                  type="button"
                  aria-pressed={choice.density === density.value}
                  disabled={locked}
                  onClick={() => setChoice((current) => ({ ...current, density: density.value }))}
                >
                  {density.label}
                </button>
              ))}
            </div>
            <span className="tv-identity-help">
              Compacto recolhe a descrição e aperta a linha. Serve a cardápio de centenas de itens, como rotisserie e self-service.
            </span>
          </div>
        </section>

        <div className="tv-identity-savebar">
          <span role="status">{pending ? 'Salvando…' : hasChanges ? 'Alterações pendentes' : 'Tudo salvo'}</span>
          <div>
            <button
              type="button"
              className="tv-identity-reset"
              disabled={locked}
              onClick={() => setChoice((current) => ({ ...current, base: null, accent: null }))}
            >
              <LuUndo2 aria-hidden="true" />
              <span className="tv-savebar-long">Restaurar as cores do tema</span>
              <span className="tv-savebar-short">Restaurar cores</span>
            </button>
            <button
              type="button"
              className="tv-identity-save"
              disabled={locked}
              aria-disabled={!canSave && !canContinue ? true : undefined}
              aria-busy={pending || undefined}
              onClick={save}
            >
              {pending ? <Spinner className="size-3.5" aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
              <span className="tv-savebar-long">{pending ? 'Salvando…' : continueLabel ?? 'Salvar identidade'}</span>
              <span className="tv-savebar-short">{pending ? 'Salvando…' : continueLabel ?? 'Salvar'}</span>
            </button>
          </div>
        </div>
      </div>

      <IdentityPreview {...previewData} />
      <FloatingRestaurantPreview renderPreview={(mode) => <ThemePreview {...previewData} mode={mode} />} />
    </div>
  )
}
