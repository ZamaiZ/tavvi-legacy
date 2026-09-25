import { z } from 'zod'

const list = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  DEVICE_CONTRACT_ENCRYPTION_KEY: z.string().refine((value) => {
    const decoded = Buffer.from(value, 'base64')
    return decoded.length === 32 && decoded.toString('base64') === value
  }, 'Must be canonical base64 encoding of exactly 32 bytes.'),
  PAINEL_PUBLIC_URL: z.string().url(),
  TRUSTED_PROXIES: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
}).superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && new URL(values.PAINEL_PUBLIC_URL).protocol !== 'https:') {
    context.addIssue({ code: 'custom', path: ['PAINEL_PUBLIC_URL'], message: 'Production panel URLs must use HTTPS.' })
  }
})

export type ServerEnv = {
  port: number
  nodeEnv: 'development' | 'production' | 'test'
  supabaseUrl: string
  supabaseAnonKey: string
  deviceContractEncryptionKey: Buffer
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
    deviceContractEncryptionKey: Buffer.from(parsed.data.DEVICE_CONTRACT_ENCRYPTION_KEY, 'base64'),
    panelPublicUrl: parsed.data.PAINEL_PUBLIC_URL.replace(/\/$/, ''),
    trustedProxies: list(parsed.data.TRUSTED_PROXIES),
    corsOrigins: list(parsed.data.CORS_ORIGINS),
  }
  return cached
}
