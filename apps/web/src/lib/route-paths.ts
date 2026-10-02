// Destino das reescritas do proxy que precisam terminar em 404 (caminho de
// outro território). Sempre cai em notFound(): `_` nunca passa no
// slugSchema, e nenhuma pasta de rota pode se chamar `_404`, porque pastas
// com `_` são privadas no App Router. Quem atende é o layout de
// `(site)/[slug]`, sem consulta ao banco, e a 404 raiz escolhe a variante
// pelo host.
export const NOT_FOUND_PATH = '/_404'

export type PrivateTerritory = 'admin' | 'painel'

const externalFirstSegments: Record<PrivateTerritory, Record<string, string>> = {
  admin: {
    entrar: 'sign-in',
    convites: 'invitations',
    restaurantes: 'restaurants',
  },
  painel: {
    entrar: 'sign-in',
    convite: 'invite',
    restaurantes: 'restaurants',
  },
}

const externalRestaurantSections: Record<string, string> = {
  comecar: 'getting-started',
  identidade: 'identity',
  equipe: 'team',
  contato: 'contact',
  servico: 'service',
  ajustes: 'settings',
  feedbacks: 'feedbacks',
}

const internalFirstSegments: Record<PrivateTerritory, Record<string, string>> = {
  admin: Object.fromEntries(
    Object.entries(externalFirstSegments.admin).map(([external, internal]) => [internal, external]),
  ),
  painel: Object.fromEntries(
    Object.entries(externalFirstSegments.painel).map(([external, internal]) => [internal, external]),
  ),
}

const internalRestaurantSections: Record<string, string> = Object.fromEntries(
  Object.entries(externalRestaurantSections).map(([external, internal]) => [internal, external]),
)

function isWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function toInternalPath(territory: PrivateTerritory, externalPath: string): string {
  const segments = externalPath.split('/').filter(Boolean)
  const root = territory === 'admin' ? '/admin' : '/admin/workspace'
  if (segments.length === 0) return root

  const originalFirst = segments[0]
  segments[0] = externalFirstSegments[territory][originalFirst] ?? originalFirst
  if (territory === 'painel' && originalFirst === 'restaurantes' && segments.length >= 3) {
    segments[2] = externalRestaurantSections[segments[2]] ?? segments[2]
  }

  return `${root}/${segments.join('/')}`
}

export function toExternalPath(internalPath: string): string {
  const territory: PrivateTerritory = isWithin(internalPath, '/admin/workspace') ? 'painel' : 'admin'
  const root = territory === 'painel' ? '/admin/workspace' : '/admin'
  if (!isWithin(internalPath, root)) return internalPath || '/'

  const segments = internalPath.slice(root.length).split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  const originalFirst = segments[0]
  segments[0] = internalFirstSegments[territory][originalFirst] ?? originalFirst
  if (territory === 'painel' && originalFirst === 'restaurants' && segments.length >= 3) {
    segments[2] = internalRestaurantSections[segments[2]] ?? segments[2]
  }

  return `/${segments.join('/')}`
}
