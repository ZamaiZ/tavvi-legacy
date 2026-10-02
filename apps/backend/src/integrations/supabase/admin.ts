import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'
import { getServerEnv } from '../../config/env.js'

// Único lugar com a chave secreta. Ela ignora o RLS: serve só às funções de
// administração do Auth e às RPCs da digital liberadas para service_role.
// Com `forwardedFor`, o Supabase conta os limites de Auth pelo IP do celular,
// e não pelo do backend (exige "IP address forwarding" ligado em
// Authentication → Rate Limits). Uma instância por operação: depois de um
// verifyOtp o cliente passa a carregar a sessão do usuário.
export function createAdminSupabaseClient(options: { forwardedFor?: string | null } = {}): SupabaseClient<Database> {
  const env = getServerEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: options.forwardedFor ? { headers: { 'Sb-Forwarded-For': options.forwardedFor } } : undefined,
  })
}
