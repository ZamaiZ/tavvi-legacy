import 'server-only'
import { reviewUrlFromLink } from '@/domain/google-review'

export type GoogleReviewResolution =
  | { status: 'ok'; url: string }
  | { status: 'not_business' }
  | { status: 'unavailable' }

// Só hosts do Google: o servidor nunca é usado para buscar outro site.
const FOLLOW_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.page',
  'google.com',
  'www.google.com',
  'google.com.br',
  'www.google.com.br',
  'maps.google.com',
  'maps.google.com.br',
  'consent.google.com',
])
const MAX_HOPS = 4
const TIMEOUT_MS = 5000

function followable(url: URL) {
  return url.protocol === 'https:' && FOLLOW_HOSTS.has(url.hostname.toLowerCase())
}

// O link curto (maps.app.goo.gl) não traz o Place ID, mas redireciona para
// a página do perfil, cujo endereço traz o par 0x…:0x…. Os saltos são
// seguidos à mão, lendo só o cabeçalho `location`; o corpo das páginas
// nunca é lido.
export async function resolveGoogleReview(mapsUrl: string): Promise<GoogleReviewResolution> {
  const direct = reviewUrlFromLink(mapsUrl)
  if (direct) return { status: 'ok', url: direct }

  let current: URL
  try {
    current = new URL(mapsUrl)
  } catch {
    return { status: 'not_business' }
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (!followable(current)) return { status: 'not_business' }

    // A página de consentimento europeia guarda o destino em `continue`:
    // lê o parâmetro em vez de buscar a página.
    if (current.hostname === 'consent.google.com') {
      const next = current.searchParams.get('continue')
      if (!next) return { status: 'not_business' }
      const found = reviewUrlFromLink(next)
      if (found) return { status: 'ok', url: found }
      try {
        current = new URL(next)
      } catch {
        return { status: 'not_business' }
      }
      continue
    }

    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        cache: 'no-store',
        signal,
        headers: { 'accept-language': 'pt-BR,pt;q=0.9' },
      })
    } catch (error) {
      console.error('[google-review] sem resposta', current.hostname, error instanceof Error ? error.message : error)
      return { status: 'unavailable' }
    }
    void response.body?.cancel()

    if (response.status === 429 || response.status >= 500) {
      console.error('[google-review] status', response.status, current.hostname)
      return { status: 'unavailable' }
    }
    const location = response.headers.get('location')
    if (!location || response.status < 300 || response.status >= 400) return { status: 'not_business' }

    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      return { status: 'not_business' }
    }
    const found = reviewUrlFromLink(next.toString())
    if (found) return { status: 'ok', url: found }
    current = next
  }
  return { status: 'not_business' }
}
