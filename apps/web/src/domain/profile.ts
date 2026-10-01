import { z } from 'zod'

// O nome que a equipe vê na lista de membros. Os limites batem com o CHECK
// de profiles (0026), que aceita de 1 a 80 caracteres; a tela pede ao menos 2.
export const displayNameSchema = z
  .string({ error: 'Informe seu nome' })
  .trim()
  .min(2, { error: 'Informe seu nome, com ao menos 2 letras' })
  .max(80, { error: 'O nome pode ter no máximo 80 caracteres' })
  .refine((value) => !/[<>]/.test(value), {
    error: 'Não são permitidos os caracteres < e >',
  })

export const updateDisplayNameSchema = z.object({ displayName: displayNameSchema })
