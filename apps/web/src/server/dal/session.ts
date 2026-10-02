import 'server-only'
import { isAuthWeakPasswordError, type AuthError } from '@supabase/supabase-js'
import { z } from 'zod'
import { displayNameSchema } from '@/domain/profile'
import { rateLimitIdentity } from '@/server/security/client-ip'
import { enforceRateLimit, RateLimitedError } from '@/server/security/rate-limit'
import { createUserClient } from './_client'
import { currentTerritory, UserFacingError } from './auth'

export const credentialsSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido' }),
  password: z.string().min(1, { error: 'Informe a senha' }),
})

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: z.email({ error: 'Informe um e-mail válido' }),
  password: z
    .string()
    .min(8, { error: 'A senha precisa de ao menos 8 caracteres' })
    .max(200, { error: 'Senha longa demais' }),
})

// Mensagem única para e-mail inexistente e senha errada. O próprio Supabase
// responde `invalid_credentials` nos dois casos, e é o certo: distinguir
// entregaria metade da credencial para quem está tentando adivinhar.
export class InvalidCredentialsError extends UserFacingError {
  constructor() {
    super('E-mail ou senha incorretos.')
  }
}

// Mensagens por código do Supabase Auth (`AuthError.code`). O que não estiver
// aqui cai na mensagem genérica do fluxo e vai para o log com código e
// status — nunca com e-mail ou senha.
const RATE_LIMIT_CODES = new Set(['over_request_rate_limit', 'over_email_send_rate_limit'])

const SIGN_IN_MESSAGES: Record<string, string> = {
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_banned: 'Esta conta está bloqueada.',
}

// "E-mail já cadastrado" é dito com todas as letras: a API pública do
// Supabase já responde `user_already_exists` para quem chamar o cadastro com
// a chave anônima, então esconder aqui não protegeria nada.
const SIGN_UP_MESSAGES: Record<string, string> = {
  user_already_exists: 'Este e-mail já tem conta. Use a aba "Já tenho conta" para entrar.',
  email_exists: 'Este e-mail já tem conta. Use a aba "Já tenho conta" para entrar.',
  email_address_invalid: 'E-mail inválido. Confira e tente de novo.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
  email_provider_disabled: 'Novos cadastros estão desativados no momento.',
}

function authFailure(
  flow: 'signIn' | 'signUp',
  error: AuthError,
  messages: Record<string, string>,
  fallback: string,
): UserFacingError {
  if (error.code && RATE_LIMIT_CODES.has(error.code)) return new RateLimitedError()
  const message = error.code ? messages[error.code] : undefined
  if (message) return new UserFacingError(message)
  console.error(`[auth] ${flow} failed`, { code: error.code, status: error.status })
  return new UserFacingError(fallback)
}

function weakPasswordMessage(reasons: string[]): string {
  if (reasons.includes('pwned')) {
    return 'Esta senha apareceu em vazamentos de dados. Escolha outra.'
  }
  if (reasons.includes('length')) return 'Senha curta demais. Use ao menos 8 caracteres.'
  return 'Senha fraca. Misture letras, números e símbolos.'
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

  if (!error) return
  if (error.code === 'invalid_credentials') throw new InvalidCredentialsError()
  throw authFailure('signIn', error, SIGN_IN_MESSAGES, 'Não foi possível entrar agora. Tente de novo em instantes.')
}

// `confirmEmail` só é verdadeiro se a confirmação de e-mail for ligada no
// Supabase: aí o cadastro dá certo, mas sem sessão, e a tela precisa dizer
// isso em vez de recarregar como se a pessoa já tivesse entrado.
export async function signUp(input: unknown): Promise<{ confirmEmail: boolean }> {
  const data = signUpSchema.parse(input)
  await enforceRateLimit('auth:login', await rateLimitIdentity())

  const supabase = await createUserClient(await currentTerritory())
  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    // O gatilho handle_new_user copia este campo para profiles.display_name.
    options: { data: { display_name: data.displayName } },
  })

  if (error) {
    if (isAuthWeakPasswordError(error)) {
      throw new UserFacingError(weakPasswordMessage(error.reasons))
    }
    throw authFailure('signUp', error, SIGN_UP_MESSAGES, 'Não foi possível criar a conta agora. Tente de novo em instantes.')
  }
  return { confirmEmail: !result.session }
}

// Só este navegador. O padrão do supabase-js é 'global' e derrubava o app do
// celular e a digital junto (spec 2026-10-01-biometria-persistente).
export async function signOut(): Promise<void> {
  const supabase = await createUserClient(await currentTerritory())
  await supabase.auth.signOut({ scope: 'local' })
}

// "Sair de todos os aparelhos": desliga as digitais e as inscrições de push
// (precisa da sessão), depois encerra todas as sessões da conta. O logout
// global vai por auth.admin.signOut com o token do próprio usuário porque
// auth.signOut apaga os cookies mesmo quando o Supabase falha; assim, numa
// falha, este navegador continua logado e "tente novamente" funciona.
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createUserClient(await currentTerritory())
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new UserFacingError('Sua sessão expirou. Entre novamente.')

  const revoked = await supabase.rpc('revoke_all_my_devices')
  if (revoked.error) {
    console.error('[auth] revoke_all_my_devices failed', { code: revoked.error.code })
    throw new UserFacingError('Não foi possível desligar a digital dos aparelhos. Nada foi encerrado; tente novamente.')
  }
  const { error } = await supabase.auth.admin.signOut(accessToken, 'global')
  if (error) {
    console.error('[auth] global signOut failed', { code: error.code, status: error.status })
    throw new UserFacingError('A digital foi desligada em todos os aparelhos, mas não foi possível encerrar as sessões abertas. Tente novamente.')
  }
  // A sessão já não existe no Supabase; o logout local só limpa os cookies.
  await supabase.auth.signOut({ scope: 'local' })
}
