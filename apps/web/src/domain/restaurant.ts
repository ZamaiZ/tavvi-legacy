import { z } from 'zod'
import { plainTextSchema, slugSchema, uuidSchema } from './common'
import { inviteTokenSchema, type MemberRole } from './invite'
import { themeSchema } from './theme'

export const restaurantStatusSchema = z.enum(['draft', 'active', 'suspended'])
export type RestaurantStatus = z.infer<typeof restaurantStatusSchema>

export const UF_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
export const ufSchema = z.enum(UF_CODES, { error: 'Escolha a UF.' })
export type UF = z.infer<typeof ufSchema>

// Endereço estruturado, montado a partir do CEP (ViaCEP). Vive dentro de
// `restaurants.contact` como objeto; o texto exibido sai sempre de
// `formatAddress`, e nunca é gravado pronto — gravar o texto e as partes
// criaria duas fontes de verdade para o mesmo endereço.
export const addressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/, { error: 'CEP inválido: informe os 8 dígitos.' }),
  street: plainTextSchema(120, 2),
  number: plainTextSchema(10, 1),
  complement: plainTextSchema(60).optional(),
  district: plainTextSchema(80, 2),
  city: plainTextSchema(80, 2),
  state: ufSchema,
})
export type Address = z.infer<typeof addressSchema>

// Hosts do link de compartilhar do Google Maps. `any` aceita qualquer
// caminho; `maps-path` só os que começam em /maps, porque google.com sozinho
// é a busca, e goo.gl sem /maps é o encurtador genérico (desativado).
const MAPS_HOSTS: Record<string, 'any' | 'maps-path'> = {
  'maps.app.goo.gl': 'any',
  'g.page': 'any',
  'maps.google.com': 'any',
  'maps.google.com.br': 'any',
  'goo.gl': 'maps-path',
  'google.com': 'maps-path',
  'www.google.com': 'maps-path',
  'google.com.br': 'maps-path',
  'www.google.com.br': 'maps-path',
}

export const MAPS_URL_ERROR = 'Cole um link do Google Maps (maps.app.goo.gl, google.com/maps ou g.page).'

export function isGoogleMapsUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const rule = MAPS_HOSTS[url.hostname.toLowerCase()]
  if (!rule) return false
  return rule === 'any' || url.pathname === '/maps' || url.pathname.startsWith('/maps/')
}

// Guardado como foi colado. O link de avaliação do Google precisa do Place
// ID, que o link curto não traz — derivá-lo fica para quando a avaliação
// for construída (spec §8).
export const mapsUrlSchema = z
  .string()
  .trim()
  .max(500, { error: 'Link longo demais (máximo de 500 caracteres).' })
  .refine(isGoogleMapsUrl, { error: MAPS_URL_ERROR })

export type RestaurantContact = {
  phone?: string
  whatsapp?: string
  instagram?: string
  address?: Address
  /** Endereço em texto livre, gravado antes do CEP. Só leitura. */
  legacyAddress?: string
  mapsUrl?: string
}

const storedTextSchema = z.string().trim().min(1).max(500)

// Única leitura do jsonb `contact`. Chave inválida é descartada em silêncio:
// um dado velho ou torto não pode derrubar o cardápio público.
export function parseContact(raw: unknown): RestaurantContact {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const contact: RestaurantContact = {}

  for (const key of ['phone', 'whatsapp', 'instagram'] as const) {
    const parsed = storedTextSchema.safeParse(source[key])
    if (parsed.success) contact[key] = parsed.data
  }

  const address = addressSchema.safeParse(source.address)
  if (address.success) {
    contact.address = address.data
  } else {
    const legacy = storedTextSchema.safeParse(source.address)
    if (legacy.success) contact.legacyAddress = legacy.data
  }

  const maps = mapsUrlSchema.safeParse(source.mapsUrl)
  if (maps.success) contact.mapsUrl = maps.data

  return contact
}

export function formatCep(cep: string): string {
  const digits = cep.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

// "Rua Rio Novo, 80, Apto 12 - Jardim São Paulo - Guarulhos / SP - CEP: 07131-020".
// O complemento vem logo depois do número, como nos Correios.
export function formatAddress(address: Address): string {
  const head = [address.street, address.number, address.complement]
    .filter((part): part is string => Boolean(part))
    .join(', ')
  return `${head} - ${address.district} - ${address.city} / ${address.state} - CEP: ${formatCep(address.cep)}`
}

export function displayAddress(contact: RestaurantContact): string | null {
  return contact.address ? formatAddress(contact.address) : (contact.legacyAddress ?? null)
}

// "Como chegar": o perfil do Maps quando o dono colou o link; sem ele, a
// busca pelo endereço, como sempre foi.
export function directionsUrl(contact: RestaurantContact): string | null {
  if (contact.mapsUrl) return contact.mapsUrl
  const text = displayAddress(contact)
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null
}

// Não existe mais criação de restaurante pela plataforma. O restaurante nasce
// dentro de `redeem_platform_invite`, e a política de INSERT em `restaurants`
// continua fechada para todo mundo: ninguém ganha o direito de criar, ganha o
// direito de resgatar um convite.

export const updateRestaurantProfileSchema = z.object({
  restaurantId: uuidSchema,
  name: plainTextSchema(120, 2),
  description: plainTextSchema(500).optional(),
  contact: z
    .object({
      phone: plainTextSchema(30).optional(),
      whatsapp: plainTextSchema(30).optional(),
      instagram: plainTextSchema(60).optional(),
      address: addressSchema.optional(),
      // O formulário devolve o texto antigo intacto enquanto o dono não o
      // substitui pelo endereço do CEP nem o remove.
      legacyAddress: plainTextSchema(200).optional(),
      mapsUrl: mapsUrlSchema.optional(),
    })
    .default({}),
})
export type UpdateRestaurantProfileInput = z.infer<
  typeof updateRestaurantProfileSchema
>

export const setRestaurantStatusSchema = z.object({
  restaurantId: uuidSchema,
  status: restaurantStatusSchema,
})

// O dono não escolhe entre três situações: ele escolhe entre estar no ar e
// não estar. `suspended` não aparece aqui porque suspender nunca foi dele —
// e o gatilho no banco recusa mesmo que a aplicação tentasse.
export const setPublishedSchema = z.object({
  restaurantId: uuidSchema,
  published: z.boolean(),
})

// Concluir ou pular o assistente de primeiros passos.
export const completeOnboardingSchema = z.object({
  restaurantId: uuidSchema,
})

// DTOs: o que sai da DAL. Nunca a linha crua do banco.
export type RestaurantPublicDTO = {
  slug: string
  name: string
  description: string | null
  logoPath: string | null
  coverPath: string | null
  contact: RestaurantContact
}

export type RestaurantAdminDTO = {
  id: string
  slug: string
  name: string
  status: RestaurantStatus
  segment: string | null
  createdAt: string
  deletedAt: string | null
}

export type RestaurantMemberDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  status: RestaurantStatus
  logoPath: string | null
  coverPath: string | null
  contact: RestaurantContact
  segment: string | null
  // `unknown` de propósito: quem sabe a forma da coluna é o `themeSchema`,
  // não este DTO. Tipar aqui seria mentir sobre dado ainda não validado.
  theme: unknown
  /** Nulo enquanto o dono não concluiu nem pulou os primeiros passos. */
  onboardingCompletedAt: string | null
}

// O seletor precisa do papel da pessoa em cada restaurante.
export type RestaurantPickerDTO = RestaurantMemberDTO & { role: MemberRole | null }

export const updateSlugSchema = z.object({
  restaurantId: uuidSchema,
  slug: slugSchema,
})

// O que o assistente envia ao confirmar o nome. Repare que não há
// `restaurantId`: o restaurante não existe ainda, e é este envio que o cria,
// junto com o resgate do convite, numa transação só.
export const createFromInviteSchema = z.object({
  token: inviteTokenSchema,
  name: plainTextSchema(120, 2),
  slug: slugSchema,
})

export const updateIdentitySchema = z.object({
  restaurantId: uuidSchema,
  segment: plainTextSchema(60, 2).nullish(),
  theme: themeSchema,
})

export type RestaurantDetailDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  status: RestaurantStatus
  contact: RestaurantContact
  createdAt: string
  updatedAt: string
  segment: string | null
  deletedAt: string | null
}

// Quem responde pelo restaurante, na consulta do console da plataforma.
export type RestaurantResponsibleDTO = {
  id: string
  name: string
  email: string
  role: MemberRole
}
