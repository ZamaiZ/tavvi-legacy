import { notFound, redirect } from 'next/navigation'
import { resolveTag } from '@/server/dal/tags'

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const resolved = await resolveTag(token)

  // Token desconhecido, plaquinha desativada e restaurante fora do ar dão
  // exatamente a mesma 404 (a variante "restaurante" do cardápio).
  // Distinguir os casos revelaria quais plaquinhas existem.
  if (!resolved) notFound()

  const query = new URLSearchParams()
  if (resolved.tableNumber !== null) query.set('tag', token)
  const search = query.toString()

  // `(site)` não tem loading.tsx, então nada foi transmitido ainda e o
  // redirect sai como HTTP 307, igual ao do antigo route.ts.
  redirect(`/${resolved.restaurantSlug}${search ? `?${search}` : ''}`)
}
