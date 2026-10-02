import { z } from 'zod'

const list = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'Use uma secret key do Supabase (sb_secret_…).'),
  PANEL_PUBLIC_URL: z.string().url(),
  TRUSTED_PROXIES: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && new URL(values.PANEL_PUBLIC_URL).protocol !== 'https:') {
    context.addIssue({ code: 'custom', path: ['PANEL_PUBLIC_URL'], message: 'Production panel URLs must use HTTPS.' })
  }
})

export type ServerEnv = {
  port: number
  nodeEnv: 'development' | 'production' | 'test'
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseSecretKey: string
  panelPublicUrl: string
  trustedProxies: string[]
  corsOrigins: string[]
}

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) throw new Error('Backend configuration is invalid. Check the required server environment variables.')
  cached = {
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    supabaseUrl: parsed.data.SUPABASE_URL.replace(/\/$/, ''),
    supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    panelPublicUrl: parsed.data.PANEL_PUBLIC_URL.replace(/\/$/, ''),
    trustedProxies: list(parsed.data.TRUSTED_PROXIES),
    corsOrigins: list(parsed.data.CORS_ORIGINS),
  }
  return cached
}
