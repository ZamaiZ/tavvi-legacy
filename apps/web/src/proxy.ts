import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/server/dal/_client'
import { territoryFromHost } from '@/server/territory'
import { toInternalPath, type PrivateTerritory } from '@/lib/route-paths'

// Rotas alcancaveis sem sessao, dentro de cada territorio privado.
const PUBLIC_PATHS: Record<PrivateTerritory, readonly string[]> = {
  admin: ['/entrar'],
  painel: ['/entrar', '/convite'],
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export async function proxy(request: NextRequest) {
  const territory = territoryFromHost(request.headers.get('host'))
  const path = request.nextUrl.pathname

  if (territory === 'site') {
    // O dominio publico nao alcanca territorio privado. Sem isto, os
    // caminhos /admin e /painel ficariam servidos tambem pela raiz.
    if (isUnder(path, '/admin') || isUnder(path, '/painel')) {
      return new NextResponse(null, { status: 404 })
    }
    // O territorio publico NAO cria cliente de auth e NAO toca cookie de
    // sessao. E isto que torna verdadeira a frase "a raiz nao tem sessao":
    // nao existe cookie de administrador neste dominio para ser roubado.
    return NextResponse.next()
  }

  if (territory === 'admin' && (isUnder(path, '/workspace') || isUnder(path, '/admin/workspace'))) {
    return new NextResponse(null, { status: 404 })
  }

  // NextResponse.rewrite precisa receber um URL absoluto. Passar o NextURL
  // clonado aqui gera `x-middleware-rewrite: /admin/...` no dev server; o
  // Next mantém a rota externa (`/entrar`) e responde com `_not-found`.
  // Construir a partir da URL da requisição preserva host, query e protocolo.
  const rewritten = new URL(request.url)
  rewritten.pathname = toInternalPath(territory, path)
  const response = NextResponse.rewrite(rewritten)

  // getUser() revalida o token contra o servidor de auth e grava a sessao
  // renovada em `response` pelo setAll. Isto e gerencia de sessao, nao
  // autorizacao: o proxy nao consulta o nosso banco nem decide permissao.
  const supabase = createProxyClient(request, response, territory)
  const { data } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS[territory].some((p) => isUnder(path, p))

  if (!data.user && !isPublic) {
    const login = request.nextUrl.clone()
    // Caminho EXTERNO, sem o prefixo do territorio. O navegador vai pedir
    // admin.dominio/entrar, que o proxy reescreve para /admin/entrar.
    // Usar `/${territory}/entrar` aqui faria o navegador pedir
    // /admin/entrar, que seria reescrito para /admin/admin/entrar.
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

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
