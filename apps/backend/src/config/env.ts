import { z } from 'zod'

// As chaves VAPID vêm em base64url sem padding, como o web-push gera:
// 65 bytes viram 87 caracteres (pública) e 32 bytes viram 43 (privada).
const BASE64URL = /^[A-Za-z0-9_-]+$/

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  // A mesma chave do web e do banco (set_app_server_key): autoriza a
  // reivindicação de push e a rota interna de entrega.
  APP_SERVER_KEY: z.string().min(32, 'APP_SERVER_KEY precisa de ao menos 32 caracteres.'),
  // Web Push. O mesmo par do web (NEXT_PUBLIC_VAPID_PUBLIC_KEY lá); gere com
  // `pnpm --filter tavvi-backend push:keys`. A privada nunca sai daqui.
  VAPID_PUBLIC_KEY: z.string().refine((value) => BASE64URL.test(value) && value.length === 87, 'VAPID_PUBLIC_KEY precisa ser a chave pública VAPID (base64url).'),
  VAPID_PRIVATE_KEY: z.string().refine((value) => BASE64URL.test(value) && value.length === 43, 'VAPID_PRIVATE_KEY precisa ser a chave privada VAPID (base64url).'),
  // Contato que Google, Apple e Mozilla usam se os envios derem problema.
  VAPID_SUBJECT: z.string().regex(/^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/, 'VAPID_SUBJECT precisa ser mailto:email ou uma URL https://.'),
})

export type ServerEnv = {
  port: number
  supabaseUrl: string
  supabaseAnonKey: string
  appServerKey: string
  vapid: { publicKey: string; privateKey: string; subject: string }
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
    supabaseUrl: parsed.data.SUPABASE_URL.replace(/\/$/, ''),
    supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    appServerKey: parsed.data.APP_SERVER_KEY,
    vapid: {
      publicKey: parsed.data.VAPID_PUBLIC_KEY,
      privateKey: parsed.data.VAPID_PRIVATE_KEY,
      subject: parsed.data.VAPID_SUBJECT,
    },
  }
  return cached
}
