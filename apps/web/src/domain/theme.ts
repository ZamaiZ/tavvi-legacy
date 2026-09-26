import { z } from 'zod'

export const THEME_PRESET_IDS = [
  'brasa',
  'forno',
  'grao',
  'sal',
  'horta',
  'neon',
  'nori',
  'confeito',
] as const

export type ThemePresetId = (typeof THEME_PRESET_IDS)[number]

export const DEFAULT_PRESET: ThemePresetId = 'grao'

const hexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: 'Use uma cor no formato #RRGGBB' })

export const densitySchema = z.enum(['confortavel', 'compacto'])
export type Density = z.infer<typeof densitySchema>

// `catch` e não `default`: a coluna `theme` é jsonb livre e pode conter
// qualquer coisa, inclusive o nome de um preset que existia e foi removido num
// deploy. Um cardápio no ar nunca deve cair por causa disso — ele volta ao
// padrão e segue servindo.
export const themeSchema = z.object({
  preset: z.enum(THEME_PRESET_IDS).catch(DEFAULT_PRESET),
  base: hexSchema.nullish().catch(null),
  accent: hexSchema.nullish().catch(null),
  density: densitySchema.catch('confortavel'),
})

export type ThemeChoice = z.infer<typeof themeSchema>

// Uma FACE do tema: o conjunto de cores de um modo (claro ou escuro).
export type FaceDefinition = {
  base: string
  accent: string
  /** Candidatas a texto. A de maior contraste contra o fundo vence. */
  ink: readonly [string, string]
  muted: readonly [string, string]
  line: readonly [string, string]
}

// O que o preset FIXA e o dono não escolhe. O dono escolhe duas cores; tudo
// aqui é decisão de desenho do tema.
export type ThemePreset = {
  id: ThemePresetId
  label: string
  /** Segmentos que este tema atende. Alimenta a sugestão no plano 3C. */
  segments: readonly string[]
  /** Variáveis CSS de `@/lib/fonts`, já com a pilha de reserva. */
  displayFont: string
  textFont: string
  /**
   * `layout` saiu na Fase 4. Ele descrevia como o item se apresentava numa
   * LISTA — foto grande, foto pequena, sem foto, cartão. O cardápio virou um
   * feed de tela cheia com mídia obrigatória, e nenhum desses quatro valores
   * descreve mais nada. Tema passou a ser paleta, tipografia e raio.
   */
  radius: { block: string; photo: string }
  /**
   * Faixa válida do fundo da face clara, em OKLCH. O dono escolhe DENTRO
   * dela; fora, o sistema recusa. Brasa aceita só fundos profundos porque
   * bege ali não é personalizar, é descaracterizar o tema e arruinar a foto
   * que vai por cima.
   */
  baseRange: { l: readonly [number, number]; c: readonly [number, number] }
  light: FaceDefinition
  dark: FaceDefinition
}
