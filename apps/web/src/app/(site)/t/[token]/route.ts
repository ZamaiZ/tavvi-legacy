import { NextResponse } from 'next/server'
import { resolveTag } from '@/server/dal/tags'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const resolved = await resolveTag(token)

  // Token desconhecido, plaquinha desativada e restaurante fora do ar
  // devolvem exatamente a mesma resposta. Distinguir os casos revelaria
  // quais plaquinhas existem.
  if (!resolved) return new NextResponse(null, { status: 404 })

  const target = new URL(`/${resolved.restaurantSlug}`, request.url)
  if (resolved.tagLabel) target.searchParams.set('mesa', resolved.tagLabel)

  return NextResponse.redirect(target, 307)
}
