import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/server/dal/_client'
import { territoryFromHost } from '@/server/territory'
import { ACTIVE_PANEL_RESTAURANT_COOKIE, NOT_FOUND_PATH, toInternalPath, type PrivateTerritory } from '@/lib/route-paths'

// Rotas alcancaveis sem sessao, dentro de cada territorio privado.
const PUBLIC_PATHS: Record<PrivateTerritory, readonly string[]> = {
  admin: ['/entrar'],
  painel: ['/entrar', '/convite'],
}

const RESTAURANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function restaurantIdFromReferer(request: NextRequest): string | null {
  const value = request.headers.get('referer')
  if (!value) return null

  try {
    const referer = new URL(value)
    if (referer.host !== request.nextUrl.host) return null
    return /^\/restaurantes\/([0-9a-f-]{36})(?:\/|$)/i.exec(referer.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

// Caminho de outro territorio vira a 404 personalizada deste host, e nao
// uma resposta vazia (que o navegador mostraria como a pagina de erro
// dele). URL absoluta pelo mesmo motivo do rewrite de baixo.
function rewriteToNotFound(request: NextRequest) {
  const target = new URL(request.url)
  target.pathname = NOT_FOUND_PATH
  return NextResponse.rewrite(target)
}

export async function proxy(request: NextRequest) {
  const territory = territoryFromHost(request.headers.get('host'))
  const path = request.nextUrl.pathname

  if (territory === 'painel') {
    const legacyCallsMatch = /^\/restaurantes\/([0-9a-f-]{36})\/chamados\/?$/i.exec(path)
    if (legacyCallsMatch && RESTAURANT_ID_PATTERN.test(legacyCallsMatch[1])) {
      const target = new URL(request.url)
      target.pathname = `/restaurantes/${legacyCallsMatch[1]}/service-calls`
      return NextResponse.redirect(target)
    }
  }

  if (territory === 'site') {
    // O dominio publico nao alcanca territorio privado. Sem isto, os
    // caminhos /admin e /painel ficariam servidos tambem pela raiz.
    if (isUnder(path, '/admin') || isUnder(path, '/painel')) {
      return rewriteToNotFound(request)
    }
    // O territorio publico NAO cria cliente de auth e NAO toca cookie de
    // sessao. E isto que torna verdadeira a frase "a raiz nao tem sessao":
    // nao existe cookie de administrador neste dominio para ser roubado.
    return NextResponse.next()
  }

  if (territory === 'admin' && (isUnder(path, '/workspace') || isUnder(path, '/admin/workspace'))) {
    return rewriteToNotFound(request)
  }

  const accountSection = territory === 'painel'
    ? path === '/perfil' ? 'profile' : path === '/configuracoes' ? 'settings' : null
    : null
  const refererRestaurantId = territory === 'painel' ? restaurantIdFromReferer(request) : null
  const cookieRestaurantId = request.cookies.get(ACTIVE_PANEL_RESTAURANT_COOKIE)?.value
  const validRefererRestaurantId = refererRestaurantId && RESTAURANT_ID_PATTERN.test(refererRestaurantId)
    ? refererRestaurantId
    : null
  const validCookieRestaurantId = cookieRestaurantId && RESTAURANT_ID_PATTERN.test(cookieRestaurantId)
    ? cookieRestaurantId
    : null
  const validSelectedRestaurantId = validRefererRestaurantId ?? validCookieRestaurantId

  // NextResponse.rewrite precisa receber um URL absoluto. Passar o NextURL
  // clonado aqui gera `x-middleware-rewrite: /admin/...` no dev server; o
  // Next mantém a rota externa (`/entrar`) e responde com `_not-found`.
  // Construir a partir da URL da requisição preserva host, query e protocolo.
  const rewritten = new URL(request.url)
  rewritten.pathname = accountSection && validSelectedRestaurantId
    ? `/admin/workspace/restaurants/${validSelectedRestaurantId}/account/${accountSection}`
    : toInternalPath(territory, path)
  // `/entrar` is also a real top-level route. Keeping this recovery path
  // external avoids the dev router resolving it through the public `[slug]`
  // route after the private-territory rewrite.
  const response = path === '/entrar'
    ? NextResponse.next()
    : NextResponse.rewrite(rewritten)

  // getUser() revalida o token contra o servidor de auth e grava a sessao
  // renovada em `response` pelo setAll. Isto e gerencia de sessao, nao
  // autorizacao: o proxy nao consulta o nosso banco nem decide permissao.
  const supabase = createProxyClient(request, response, territory)
  const { data } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS[territory].some((p) => isUnder(path, p))

  if (!data.user && !isPublic) {
    const login = request.nextUrl.clone()
    // Caminho externo de recuperação. `/entrar` é uma rota real e compartilhada
    // entre os territórios privados; os outros caminhos seguem pela reescrita.
    login.pathname = '/entrar'
    login.searchParams.set('next', path)

    const redirect = NextResponse.redirect(login)
    // Os cookies renovados precisam sobreviver ao redirecionamento. Montar
    // uma resposta nova sem copiar os cookies descarta a sessao renovada, e
    // o sintoma e deslogar de forma intermitente e dificil de rastrear.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  if (accountSection && !validSelectedRestaurantId) {
    const redirect = NextResponse.redirect(new URL('/restaurantes', request.url))
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie)
    }
    return redirect
  }

  return response
}

// /pwa/ (manifesto, ícones, telas de abertura e a rota do
// pushsubscriptionchange) chega igual nos três hosts: sem reescrita de
// território e sem desvio para /entrar.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|pwa/|.*\\..*).*)'],
}
