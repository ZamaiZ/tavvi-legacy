import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.js'
import { getServerEnv } from '../../config/env.js'

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

export function createAnonymousSupabaseClient(): SupabaseClient<Database> {
  const env = getServerEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: authOptions })
}
