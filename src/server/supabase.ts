import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getServerEnv } from './env'

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
export function createAnonymousServerClient(): SupabaseClient<Database> {
  const env = getServerEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: authOptions })
}
export function createUserServerClient(accessToken: string): SupabaseClient<Database> {
  const env = getServerEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: authOptions, global: { headers: { Authorization: `Bearer ${accessToken}` } } })
}
