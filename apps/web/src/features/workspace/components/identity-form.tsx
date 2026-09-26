'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  RiArrowGoBackLine,
  RiCheckLine,
} from 'react-icons/ri'
import { BrandImages } from '@/features/workspace/components/brand-images'
import { FloatingRestaurantPreview } from '@/features/workspace/components/floating-restaurant-preview'
import { ThemePreview } from '@/features/workspace/components/theme-preview'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { SORTED_SEGMENTS, suggestPresetFor } from '@/domain/segment'
import {
  THEME_PRESET_IDS,
  themeSchema,
  type Density,
  type ThemeChoice,
  type ThemePresetId,
} from '@/domain/theme'
import { fitContrast } from '@/lib/color'
import { isBaseInRange, PRESETS } from '@/lib/theme/presets'
import { CONTRAST_MINIMUMS } from '@/lib/theme/resolve'
import { getAccentOptions, getBaseOptions } from '@/features/workspace/components/identity-theme-options'
import { updateIdentityAction } from '@/server/actions/restaurants'
import { cn } from 'cn'

export function IdentityForm({
  restaurantId,
  name,
  segment,
  theme,
  logoPath,
  coverPath,
  onSaved,
}: {
  restaurantId: string
  name: string
  segment: string | null
  theme: unknown
  logoPath: string | null
  coverPath: string | null
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
  // O aceite da derivação é por MUDANÇA, não por sessão: quem abre a tela e
  // não mexe na cor não é interrogado de novo sobre uma escolha que já fez.
  const [accentTouched, setAccentTouched] = useState(false)
  const [accentAccepted, setAccentAccepted] = useState(false)
  const [pending, startTransition] = useTransition()

  const preset = PRESETS[choice.preset]
  const currentBase = choice.base ?? preset.light.base
  const currentAccent = choice.accent ?? preset.light.accent
  const baseOptions = useMemo(() => getBaseOptions(choice.preset), [choice.preset])
  const accentOptions = useMemo(
    () => getAccentOptions(choice.preset, currentBase, currentAccent),
    [currentAccent, currentBase, choice.preset],
  )

  // As duas conferências do servidor, repetidas aqui. Isto é conveniência —
  // a regra é o `updateIdentity`, que roda de novo e recusa. Mas dizer
  // "não passa" no momento da escolha é muito melhor que dizer ao salvar.
  const isBaseValid = useMemo(
    () => isBaseInRange(choice.preset, currentBase),
    [choice.preset, currentBase],
  )
  // A derivação por face, a mesma que `resolveTheme` faz para desenhar o
  // cardápio e que `updateIdentity` confere antes de gravar. `null` numa das
  // faces quer dizer que nem o extremo de luminosidade atinge o piso — e aí
  // a cor é recusada, não adaptada.
  const derivedAccent = useMemo(
    () => ({
      light: fitContrast(currentAccent, currentBase, CONTRAST_MINIMUMS.accent),
      dark: fitContrast(currentAccent, preset.dark.base, CONTRAST_MINIMUMS.accent),
    }),
    [currentAccent, currentBase, preset],
  )

  const isAccentValid = derivedAccent.light !== null && derivedAccent.dark !== null
  const hasChanges = JSON.stringify(choice) !== JSON.stringify(savedChoice) || selectedSegment !== savedSegment

  // Só pede aceite quando a derivação de fato MUDOU a cor. Cor que já serve
  // nas duas faces passa direto: pedir confirmação do que não mudou é ruído
  // que ensina a clicar sem ler.
  const needsAcceptance =
    accentTouched &&
    isAccentValid &&
    (derivedAccent.light !== currentAccent || derivedAccent.dark !== currentAccent)

  function updateSegment(value: string) {
    const nextSegment = value === '' ? null : value
    setSelectedSegment(nextSegment)

    // Sugere o tema, e só enquanto a pessoa não tiver escolhido um à mão.
    // Depois disso a escolha é dela, e sobrescrever seria desfazer decisão.
    if (!themeTouched) {
      const suggestedPreset = suggestPresetFor(nextSegment)
      if (suggestedPreset) setChoice((current) => ({ ...current, preset: suggestedPreset }))
    }
  }

  function updatePreset(id: ThemePresetId) {
    setThemeTouched(true)
    // As cores voltam ao padrão do preset novo: um fundo escolhido dentro da
    // faixa do Grão quase nunca está dentro da faixa do Brasa, e carregar a
    // cor antiga produziria um estado recusado já no primeiro render.
    setChoice((current) => ({ ...current, preset: id, base: null, accent: null }))
    // E o aceite zera junto: a cor voltou a ser a do preset, que é calibrada
    // e não precisa de aceite nenhum.
    setAccentTouched(false)
    setAccentAccepted(false)
  }

  function save() {
    startTransition(async () => {
      const result = await updateIdentityAction({
        restaurantId,
        segment: selectedSegment,
        theme: choice,
      })
      if (result.ok) {
        setSavedChoice(choice)
        setSavedSegment(selectedSegment)
        toast.add({ title: 'Identidade salva', type: 'success' })
        onSaved?.()
      } else {
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  return (
    <div className="tv-identity-layout">
      <div className="tavvi-surface space-y-6 p-5 sm:p-6">
        {/* Logo e capa gravam SOZINHAS, na hora do envio — não esperam o
            "Salvar identidade". Envio de arquivo já é uma confirmação por si,
            e amarrar o arquivo a um botão de salvar criaria um estado onde o
            arquivo está no storage mas o banco ainda não sabe dele. */}
        <BrandImages
          restaurantId={restaurantId}
          logoPath={logoPath}
          coverPath={coverPath}
        />

        <Field>
          <FieldLabel htmlFor="segment">Tipo de restaurante</FieldLabel>
          <NativeSelect
            id="segment"
            value={selectedSegment ?? ''}
            onChange={(event) => updateSegment(event.target.value)}
          >
            <option value="">Não informar</option>
            {SORTED_SEGMENTS.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            Só serve para sugerir um tema. Você pode trocar o tema depois.
          </FieldDescription>
        </Field>

        <div>
          <p className="text-small font-medium">Tema do cardápio</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEME_PRESET_IDS.map((id) => {
              const p = PRESETS[id]
              const isSelected = choice.preset === id
              const suggestedPreset = suggestPresetFor(selectedSegment) === id

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updatePreset(id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-11 flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-accent'
                      : 'border-border hover:bg-accent/50',
                  )}
                >
                  <span className="flex gap-1" aria-hidden="true">
                    {[p.light.base, p.light.accent, p.dark.base].map((color, i) => (
                      <i
                        key={i}
                        className="size-3.5 rounded-full border border-border"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  <span aria-hidden="true" className="text-lg leading-none" style={{ color: p.light.accent, fontFamily: p.displayFont }}>Aa</span>
                  <span className="text-card font-semibold">{p.label}</span>
                  {suggestedPreset ? (
                    <span className="text-micro font-semibold uppercase tracking-wider text-primary">
                      Sugerido
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-small text-muted-foreground">
            {preset.segments.slice(0, 5).join(' · ')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="base">Cor de fundo</FieldLabel>
            <div className="tv-theme-colors" role="group" aria-label="Opções de cor de fundo">
              {baseOptions.map((color) => <button
                key={color}
                type="button"
                title={color}
                aria-label={`Cor de fundo ${color}`}
                aria-pressed={currentBase.toLowerCase() === color.toLowerCase()}
                onClick={() => setChoice((current) => ({ ...current, base: color === preset.light.base ? null : color }))}
                style={{ backgroundColor: color }}
              />)}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{currentBase}</p>
            <FieldDescription>
              {isBaseValid ? (
                'Dentro da faixa deste tema.'
              ) : (
                <span className="text-destructive">
                  Fora da faixa do tema {preset.label}. O cardápio ficaria
                  ilegível, e o servidor vai recusar.
                </span>
              )}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="accent">Cor de destaque</FieldLabel>
            <div className="tv-theme-colors" role="group" aria-label="Cores de destaque deste tema">
              {accentOptions.map((color) => <button
                key={color}
                type="button"
                title={color}
                aria-label={`Cor de destaque ${color}`}
                aria-pressed={currentAccent.toLowerCase() === color.toLowerCase()}
                onClick={() => {
                  setAccentTouched(true)
                  setAccentAccepted(false)
                  setChoice((current) => ({ ...current, accent: color === preset.light.accent ? null : color }))
                }}
                style={{ backgroundColor: color }}
              />)}
            </div>
            <p className="font-mono text-xs text-muted-foreground">{currentAccent}</p>
            <FieldDescription>
              {isAccentValid ? (
                'O matiz é mantido nas duas versões do cardápio; só a luminosidade se ajusta quando precisa.'
              ) : (
                <span className="text-destructive">
                  Não fica legível na versão{' '}
                  {derivedAccent.light === null && derivedAccent.dark === null
                    ? 'clara nem na escura'
                    : derivedAccent.light === null
                      ? 'clara'
                      : 'escura'}{' '}
                  do cardápio. Escolha um tom mais vivo ou menos acinzentado.
                </span>
              )}
            </FieldDescription>
          </Field>
        </div>

        {/* A derivação não é silenciosa. Sem isto, a cor da marca mudaria
            pelas costas do dono e ele só descobriria se olhasse a
            pré-visualização escura. */}
        {needsAcceptance ? (
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-small font-medium">
              Esta cor precisa de ajuste para ficar legível
            </p>
            <p className="mt-1 text-small text-muted-foreground">
              O matiz é mantido; só a luminosidade muda, e só na versão em que
              a cor original não seria lida.
            </p>

            <div className="mt-3 flex flex-wrap gap-4">
              {[
                { label: 'Você escolheu', color: currentAccent },
                { label: 'No claro', color: derivedAccent.light ?? currentAccent },
                { label: 'No escuro', color: derivedAccent.dark ?? currentAccent },
              ].map((sample) => (
                <div key={sample.label}>
                  <span
                    className="block size-10 rounded-md border border-border"
                    style={{ background: sample.color }}
                  />
                  <p className="mt-1 text-micro text-muted-foreground">
                    {sample.label}
                  </p>
                  <p className="text-micro font-medium">{sample.color}</p>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAccentAccepted(true)}
            >
              <RiCheckLine className="size-4" />
              Entendi, usar assim
            </Button>
          </div>
        ) : null}

        <div>
          <p className="text-small font-medium">Densidade</p>
          <div className="mt-3 flex gap-2">
            {(['confortavel', 'compacto'] as Density[]).map((d) => (
              <Button
                key={d}
                type="button"
                variant={choice.density === d ? 'default' : 'outline'}
                onClick={() => setChoice((currentChoice) => ({ ...currentChoice, density: d }))}
              >
                {d === 'confortavel' ? 'Confortável' : 'Compacto'}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-small text-muted-foreground">
            Compacto recolhe a descrição e aperta a linha. Serve a cardápio de
            centenas de itens, como rotisserie e self-service.
          </p>
        </div>

        <div className="tv-identity-savebar">
          <span>{hasChanges ? 'Alterações pendentes' : 'Tudo salvo'}</span>
          <div className="flex flex-wrap gap-2">
          <Button
            onClick={save}
            disabled={
              pending ||
              !hasChanges ||
              !isBaseValid ||
              !isAccentValid ||
              (needsAcceptance && !accentAccepted)
            }
          >
            {pending ? <Spinner className="size-4" /> : <RiCheckLine className="size-4" />}
            {pending ? 'Salvando…' : 'Salvar identidade'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setChoice((currentChoice) => ({ ...currentChoice, base: null, accent: null }))
              setAccentTouched(false)
              setAccentAccepted(false)
            }}
          >
            <RiArrowGoBackLine className="size-4" />
            Restaurar as cores do tema
          </Button>
          </div>
        </div>
      </div>

      <FloatingRestaurantPreview
        renderPreview={(mode) => <ThemePreview theme={choice} name={name} mode={mode} />}
      />
    </div>
  )
}
