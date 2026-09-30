import { z } from 'zod'
import { MAX_PRICE_CENTS } from '@/lib/money'

export const uuidSchema = z.uuid({ error: 'Identificador inválido' })

export const slugSchema = z
  .string()
  .min(3, { error: 'O endereço precisa de ao menos 3 caracteres' })
  .max(50, { error: 'O endereço pode ter no máximo 50 caracteres' })
  .regex(/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$/, {
    error: 'Use apenas letras minúsculas, números e hífen',
  })

export const priceCentsSchema = z
  .int({ error: 'O preço precisa ser um número inteiro de centavos' })
  .min(0, { error: 'O preço não pode ser negativo' })
  .max(MAX_PRICE_CENTS, { error: 'Preço acima do limite' })

export const positionSchema = z.int().min(0).max(10_000)

// Texto puro, sem HTML e sem markdown. Isto elimina a classe XSS inteira
// em vez de apostar num sanitizador.
//
// O mínimo entra como argumento, e não encadeado como .min() depois: em
// Zod 4, .refine() devolve um tipo que não expõe mais .min(), então
// plainTextSchema(120).min(2) não compila.
export const plainTextSchema = (max: number, min = 0) => {
  const base = z.string().trim().max(max, { error: `Máximo de ${max} caracteres` })
  const bounded =
    min > 0 ? base.min(min, { error: `Mínimo de ${min} caracteres` }) : base

  return bounded.refine((value) => !/[<>]/.test(value), {
    error: 'Não são permitidos os caracteres < e >',
  })
}

// O destino pós-login só pode ser caminho interno. Barra o open redirect.
export const internalPathSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.startsWith('/\\'),
    { error: 'Destino inválido' },
  )

export function safeNextPath(value: unknown, fallback: string): string {
  const parsed = internalPathSchema.safeParse(value)
  return parsed.success ? parsed.data : fallback
}
