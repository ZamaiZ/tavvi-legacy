import { z } from 'zod'

const list = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean)

// As chaves VAPID vêm em base64url sem padding, como o web-push gera:
// 65 bytes viram 87 caracteres (pública) e 32 bytes viram 43 (privada).
const BASE64URL = /^[A-Za-z0-9_-]+$/

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().startsWith('sb_secret_', 'Use uma secret key do Supabase (sb_secret_…).'),
  PANEL_PUBLIC_URL: z.string().url(),
  TRUSTED_PROXIES: z.string().optional().default(''),
  CORS_ORIGINS: z.string().optional().default(''),
  // A mesma chave do web e do banco (set_app_server_key): autoriza a
  // reivindicação de push e a rota interna de entrega.
  APP_SERVER_KEY: z.string().min(32, 'APP_SERVER_KEY precisa de ao menos 32 caracteres.'),
  // Web Push. O mesmo par do web (NEXT_PUBLIC_VAPID_PUBLIC_KEY lá); gere com
  // `pnpm --filter tavvi-backend push:keys`. A privada nunca sai daqui.
  VAPID_PUBLIC_KEY: z.string().refine((value) => BASE64URL.test(value) && value.length === 87, 'VAPID_PUBLIC_KEY precisa ser a chave pública VAPID (base64url).'),
  VAPID_PRIVATE_KEY: z.string().refine((value) => BASE64URL.test(value) && value.length === 43, 'VAPID_PRIVATE_KEY precisa ser a chave privada VAPID (base64url).'),
  // Contato que Google, Apple e Mozilla usam se os envios derem problema.
  VAPID_SUBJECT: z.string().regex(/^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/, 'VAPID_SUBJECT precisa ser mailto:email ou uma URL https://.'),
  // Opcional: exigido só com o "enhanced push security" ligado no EAS.
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
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
  appServerKey: string
  vapid: { publicKey: string; privateKey: string; subject: string }
  expoAccessToken: string | null
}

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    // Só os nomes, nunca os valores: diz qual variável falta sem vazar segredo.
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))].join(', ')
    throw new Error(`Backend configuration is invalid. Check the required server environment variables: ${names}.`)
  }
  cached = {
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    supabaseUrl: parsed.data.SUPABASE_URL.replace(/\/$/, ''),
    supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    panelPublicUrl: parsed.data.PANEL_PUBLIC_URL.replace(/\/$/, ''),
    trustedProxies: list(parsed.data.TRUSTED_PROXIES),
    corsOrigins: list(parsed.data.CORS_ORIGINS),
    appServerKey: parsed.data.APP_SERVER_KEY,
    vapid: {
      publicKey: parsed.data.VAPID_PUBLIC_KEY,
      privateKey: parsed.data.VAPID_PRIVATE_KEY,
      subject: parsed.data.VAPID_SUBJECT,
    },
    expoAccessToken: parsed.data.EXPO_ACCESS_TOKEN ?? null,
  }
  return cached
}
