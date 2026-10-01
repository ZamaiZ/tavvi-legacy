import 'server-only'
import { z } from 'zod'

// As chaves VAPID vêm em base64url sem padding, como o web-push gera:
// 65 bytes viram 87 caracteres (pública) e 32 bytes viram 43 (privada).
const BASE64URL = /^[A-Za-z0-9_-]+$/

// Validar no boot faz variável faltando derrubar a subida, em vez de virar
// undefined silencioso que aparece como bug três telas adiante.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: 'NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, {
    error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY ausente ou truncada',
  }),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1, {
    error: 'NEXT_PUBLIC_ROOT_DOMAIN ausente',
  }),
  API_BASE_URL: z.url({ error: 'API_BASE_URL precisa ser a origem da API Express' }),
  DEV_TUNNEL_HOST: z.string().min(1).optional(),
  DEV_TUNNEL_TERRITORY: z.enum(['admin', 'painel']).optional(),
  // Web Push. A pública vai ao navegador (pushManager.subscribe); a privada
  // assina cada envio e nunca sai do servidor. Gere o par com
  // `pnpm --filter @tavvi/web push:keys`. Trocar o par em produção invalida
  // as inscrições: cada aparelho se reinscreve ao abrir o app.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .string({ error: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente' })
    .refine((value) => BASE64URL.test(value) && value.length === 87, {
      error: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY precisa ser a chave pública VAPID (base64url)',
    }),
  VAPID_PRIVATE_KEY: z
    .string({ error: 'VAPID_PRIVATE_KEY ausente' })
    .refine((value) => BASE64URL.test(value) && value.length === 43, {
      error: 'VAPID_PRIVATE_KEY precisa ser a chave privada VAPID (base64url)',
    }),
  // Contato que Google, Apple e Mozilla usam se os envios derem problema.
  // A Apple recusa https://localhost.
  VAPID_SUBJECT: z
    .string({ error: 'VAPID_SUBJECT ausente' })
    .regex(/^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/, {
      error: 'VAPID_SUBJECT precisa ser mailto:email ou uma URL https://',
    }),
}).refine(
  (values) => !values.DEV_TUNNEL_HOST === !values.DEV_TUNNEL_TERRITORY,
  {
    error: 'DEV_TUNNEL_HOST e DEV_TUNNEL_TERRITORY precisam vir juntas',
    path: ['DEV_TUNNEL_HOST'],
  },
)

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  API_BASE_URL: process.env.API_BASE_URL,
  DEV_TUNNEL_HOST: process.env.DEV_TUNNEL_HOST || undefined,
  DEV_TUNNEL_TERRITORY: process.env.DEV_TUNNEL_TERRITORY || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
})

if (!parsed.success) {
  throw new Error(
    'Variáveis de ambiente inválidas:\n' +
      parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n'),
  )
}

export const env = parsed.data
