import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { UserFacingError } from '@/server/dal/auth'
import { replacePushSubscription } from '@/server/dal/push'
import { RateLimitedError } from '@/server/security/rate-limit'
import { territoryFromHost } from '@/server/territory'

// O service worker chama esta rota no pushsubscriptionchange, quando o
// navegador troca a inscrição sozinho e o app pode nem estar aberto. Server
// action não serve: o service worker não tem como chamá-la.
//
// /pwa/ fica fora do proxy (matcher em src/proxy.ts): sem reescrita de
// território e sem desvio para /entrar. A sessão vem do cookie, como numa
// server action.

function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const host = request.headers.get('host')
  if (territoryFromHost(host) === 'site') return new NextResponse(null, { status: 404 })
  // Escrita com cookie de sessão: só a própria origem.
  if (!sameOrigin(request.headers.get('origin'), host)) return new NextResponse(null, { status: 403 })

  try {
    await replacePushSubscription(await request.json())
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof RateLimitedError) return new NextResponse(null, { status: 429 })
    if (error instanceof UserFacingError) return new NextResponse(null, { status: 401 })
    if (error instanceof ZodError || error instanceof SyntaxError) return new NextResponse(null, { status: 400 })
    console.error('[pwa/push-subscription]', error)
    return new NextResponse(null, { status: 500 })
  }
}
