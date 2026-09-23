import { HttpError } from './http'

export type ServerEnv = { supabaseUrl: string; supabaseAnonKey: string; painelPublicUrl: string }
let cached: ServerEnv | null = null
export function getServerEnv(): ServerEnv {
  if (cached) return cached
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const painelPublicUrl = process.env.PAINEL_PUBLIC_URL?.replace(/\/$/, '')
  if (!supabaseUrl || !supabaseAnonKey || !painelPublicUrl) throw new HttpError(500, 'SERVER_CONFIGURATION_ERROR', 'Servidor não configurado.')
  if (process.env.NODE_ENV === 'production' && new URL(painelPublicUrl).protocol !== 'https:') throw new HttpError(500, 'SERVER_CONFIGURATION_ERROR', 'Servidor não configurado.')
  cached = { supabaseUrl, supabaseAnonKey, painelPublicUrl }
  return cached
}
