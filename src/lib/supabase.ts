import { createClient, processLock } from '@supabase/supabase-js'
import { secureStoreAdapter } from './secure-store-adapter'

export const publicEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, ''),
}

export const publicEnvReady = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && publicEnv.apiUrl)

export const supabase = createClient(
  publicEnv.supabaseUrl ?? 'https://configuration-required.supabase.co',
  publicEnv.supabaseAnonKey ?? 'configuration-required',
  { auth: { storage: secureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock } },
)
