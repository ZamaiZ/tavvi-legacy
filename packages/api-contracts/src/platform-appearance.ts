import { z } from 'zod'

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Informe uma cor hexadecimal no formato #RRGGBB.').transform((value) => value.toUpperCase())

export const platformAppearanceSourceSchema = z.object({
  brandAccent: hexColorSchema,
  onAccentOverride: hexColorSchema.nullable(),
})

export const accentPaletteSchema = z.object({
  accent: hexColorSchema,
  'accent-pressed': hexColorSchema,
  'accent-on': hexColorSchema,
  'accent-text-light': hexColorSchema,
  'accent-text-dark': hexColorSchema,
  'accent-soft': z.string(),
  'accent-glow': z.string(),
  'accent-cta-glow': z.string(),
  'accent-hero-glow': z.string(),
  'accent-focus': hexColorSchema,
  'accent-ring': z.string(),
  'accent-pill': hexColorSchema,
  'accent-pill-on': hexColorSchema,
  'accent-surface': z.string(),
})

export const platformAppearanceSchema = z.object({
  source: platformAppearanceSourceSchema,
  schemaVersion: z.number().int().positive(),
  palette: z.object({ light: accentPaletteSchema, dark: accentPaletteSchema }),
  updatedAt: z.string(),
})

export type PlatformAppearanceSource = z.infer<typeof platformAppearanceSourceSchema>
export type PlatformAppearance = z.infer<typeof platformAppearanceSchema>
export type UpdatePlatformAppearanceInput = PlatformAppearanceSource
