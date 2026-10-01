import { z } from 'zod'

// Contrato entre o navegador, as server actions e o service worker
// (public/sw.js lê title, body, url e tag do payload).

// Serviços de push só usam https. O tamanho máximo segue a coluna do banco.
export const pushEndpointSchema = z
  .string()
  .max(2048)
  .pipe(z.url({ protocol: /^https$/, error: 'Endereço de notificação inválido' }))

// O mesmo formato de PushSubscription.toJSON().
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

// Corpo que o service worker manda no pushsubscriptionchange.
export const pushSubscriptionChangeSchema = z.object({
  oldEndpoint: pushEndpointSchema.nullable(),
  subscription: pushSubscriptionSchema,
})

export type PushMessage = {
  title: string
  body: string
  // Caminho EXTERNO na mesma origem (/restaurantes/…), aberto no clique.
  url: string
  // Avisos com a mesma tag se substituem em vez de empilhar.
  tag: string
}
