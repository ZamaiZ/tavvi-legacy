import { NextResponse } from 'next/server'
import { pwaManifest } from '@/lib/pwa'
import { territoryFromHost } from '@/server/territory'

// Manifesto do território do host, o mesmo critério do proxy.ts. Na raiz,
// 404: o cardápio público não é instalável. Os dados ficam em lib/pwa.ts.
//
// Não é app/manifest.ts de propósito: aquele arquivo seria ligado em todas
// as páginas, cardápio público incluído, e não sabe de território.
export function GET(request: Request) {
  const territory = territoryFromHost(request.headers.get('host'))
  if (territory === 'site') return new NextResponse(null, { status: 404 })

  return NextResponse.json(pwaManifest(territory), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
