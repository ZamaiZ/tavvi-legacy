import 'server-only'
import { z } from 'zod'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, UserFacingError } from './auth'

export const credentialsSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido' }),
  password: z.string().min(1, { error: 'Informe a senha' }),
})

export const signUpSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido' }),
  password: z
    .string()
    .min(8, { error: 'A senha precisa de ao menos 8 caracteres' })
    .max(200, { error: 'Senha longa demais' }),
})

// Mensagem única para qualquer falha de entrada. Distinguir "e-mail não
// existe" de "senha errada" entrega metade da credencial para quem está
// tentando adivinhar — e o e-mail do administrador é o alvo que interessa.
export class InvalidCredentialsError extends UserFacingError {
  constructor() {
    super('E-mail ou senha incorretos.')
  }
}

export async function signIn(input: unknown): Promise<void> {
  const data = credentialsSchema.parse(input)
  // Rate limit ANTES de falar com o servidor de auth, no balde auth:login
  // que a Fase 0 já definiu: 10 por minuto por IP.
  await enforceRateLimit('auth:login', await rateLimitIdentity())

  const supabase = await createUserClient(await currentTerritory())
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })

  if (error) throw new InvalidCredentialsError()
}

export async function signUp(input: unknown): Promise<void> {
  const data = signUpSchema.parse(input)
  await enforceRateLimit('auth:login', await rateLimitIdentity())

  const supabase = await createUserClient(await currentTerritory())
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })

  // Mensagem única aqui também, pela mesma razão: um cadastro que responde
  // "e-mail já cadastrado" vira um verificador de quem tem conta.
  if (error) {
    throw new UserFacingError('Não foi possível criar a conta com esses dados.')
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createUserClient(await currentTerritory())
  await supabase.auth.signOut()
}
