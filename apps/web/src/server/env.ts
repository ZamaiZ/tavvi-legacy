import 'server-only'
import { z } from 'zod'

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
