import {
  DEFAULT_PRESET,
  themeSchema,
  type Density,
  type FaceDefinition,
  type ThemePreset,
  type ThemePresetId,
} from '@/domain/theme'
import { fitContrast, hexToOklch, pickByContrast } from '@/lib/color'
import { isBaseInRange, PRESETS } from './presets'

export const CONTRAST_MINIMUMS = {
  ink: 7,
  muted: 4.5,
  accent: 4.5,
  onAccent: 4.5,
} as const

// Faixa MEDIDA, não arbitrada: com a regra de `lineFor`, os dezesseis fios
// calibrados na Fase 3 caem entre 1,11 e 1,24 — a mesma ordem de grandeza do
// cinza de borda padrão do Tailwind sobre branco. Uma faixa mais apertada
// reprovaria os dezesseis sem ganho. O piso pega o fio que sumiu no fundo; o
// teto pega o defeito da Fase 4, que estava em 12–15:1.
export const LINE_CONTRAST_RANGE = { min: 1.08, max: 2.5 } as const

export type ResolvedTheme = {
  presetId: ThemePresetId
  density: Density
  styleLight: Record<string, string>
  styleDark: Record<string, string>
}

// O fio é escolhido pela LUMINOSIDADE do fundo, e não pelo nome da face.
// Brasa e Neon têm face "clara" com fundo escuro — `brasa.light.base` é
// #0d0c0b, L = 0,16 — e indexar por nome daria fio claro sobre quase-preto
// nos dois. Isto também vale para um fundo personalizado que o dono escolheu
// dentro da faixa do preset.
export function lineFor(base: string, colorPair: readonly [string, string]): string {
  return hexToOklch(base).l >= 0.5 ? colorPair[0] : colorPair[1]
}

// O par que o destaque forma quando ele vira SUPERFÍCIE, e não texto. O
// destaque pode pousar em meio-tom — é o preço de derivá-lo contra o fundo —
// e meio-tom é justamente onde nenhuma cor do preset contrasta o bastante.
//
// Daí os dois degraus: escolher a melhor candidata, e empurrá-la. Se nem
// assim, cai em preto ou branco puro, o que garante o máximo disponível.
// Nunca devolve algo pior que a escolha simples.
function onAccentFor(accent: string, ink: readonly [string, string]): string {
  const candidate = pickByContrast(accent, ink)
  const adjustedAccent = fitContrast(candidate, accent, CONTRAST_MINIMUMS.onAccent)
  if (adjustedAccent) return adjustedAccent

  return pickByContrast(accent, ['#000000', '#ffffff'])
}

function faceToVars(
  preset: ThemePreset,
  face: FaceDefinition,
  base: string,
  selectedAccent: string | null,
): Record<string, string> {
  // O destaque do dono é DERIVADO contra o fundo desta face. Sem isto, uma
  // cor escolhida e aprovada na face clara ia crua para a escura — foi
  // exatamente assim que #241e0a foi parar a 1,1:1 sobre #131312 num
  // cardápio no ar.
  //
  // O `?? face.accent` é a rede: quando nem o extremo de luminosidade atinge
  // o piso, a face fica com o destaque do preset, que é calibrado. Recusar a
  // gravação é trabalho do servidor e do formulário; aqui um cardápio no ar
  // não pode cair por causa de uma cor.
  const rawAccent = selectedAccent ?? face.accent
  const accent = fitContrast(rawAccent, base, CONTRAST_MINIMUMS.accent) ?? face.accent

  return {
    '--m-base': base,
    '--m-ink': pickByContrast(base, face.ink),
    '--m-muted': pickByContrast(base, face.muted),
    '--m-line': lineFor(base, face.line),
    // Fundo dos atalhos de contato que não são o principal. Mesma regra do
    // fio: decide pela luminosidade do fundo, não pelo nome da face.
    '--m-chip': hexToOklch(base).l >= 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)',
    '--m-accent': accent,
    // O texto SOBRE o destaque: escolhe a melhor candidata contra o destaque
    // JÁ DERIVADO — derivar depois de escolher inverteria o par — e DEPOIS
    // move a luminosidade dela até o piso, igual ao que se faz com o próprio
    // destaque.
    //
    // A escolha sozinha não basta, e o guarda provou: quando `fitContrast`
    // move o destaque até RASPAR o piso contra o fundo, ele pousa em
    // meio-tom, e aí nenhuma das duas tintas do preset alcança 4,5:1 contra
    // ele. Foram 44 faces reprovadas assim. Com o empurrão, a candidata vai
    // até preto ou branco se precisar.
    '--m-on-accent': onAccentFor(accent, face.ink),
    // O véu é o fundo da face com alpha alto. É ele que torna o contraste
    // medível quando o que está atrás do texto é foto de prato, e não cor
    // conhecida.
    '--m-veil': `color-mix(in oklab, ${base} 94%, transparent)`,
    '--m-radius-block': preset.radius.block,
    '--m-radius-photo': preset.radius.photo,
    '--m-font-display': preset.displayFont,
    '--m-font-text': preset.textFont,
  }
}

export function resolveTheme(raw: unknown): ResolvedTheme {
  // `safeParse`, e não `parse`. Os `catch` de cada campo cobrem valor ruim
  // DENTRO de um objeto, mas a coluna é jsonb livre e pode conter `42` ou uma
  // string — aí o erro é no nível do objeto e nenhum catch de campo pega.
  // Cardápio no ar não pode cair por causa do conteúdo de uma coluna.
  const parsed = themeSchema.safeParse(raw ?? {})
  const choice = parsed.success
    ? parsed.data
    : {
        preset: DEFAULT_PRESET,
        base: null,
        accent: null,
        density: 'confortavel' as const,
      }

  const preset = PRESETS[choice.preset]

  // O dono escolhe o fundo da face CLARA. A escura mantém o padrão do preset,
  // porque derivar um escuro bom a partir de um claro qualquer não é
  // confiável, e um cardápio ilegível à noite é pior que um previsível.
  const baseLight =
    choice.base && isBaseInRange(choice.preset, choice.base)
      ? choice.base
      : preset.light.base

  const accent = choice.accent ?? null

  return {
    presetId: preset.id,
    density: choice.density,
    styleLight: faceToVars(preset, preset.light, baseLight, accent),
    styleDark: faceToVars(preset, preset.dark, preset.dark.base, accent),
  }
}
