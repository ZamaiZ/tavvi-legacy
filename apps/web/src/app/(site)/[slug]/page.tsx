import { notFound } from 'next/navigation'
import { MenuFeed } from '@/features/public-menu/components/menu-feed'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { resolveTheme } from '@/lib/theme/resolve'
import { getPublicMenu } from '@/server/dal/menu-read'
import { tagTokenSchema } from '@/domain/tag'
import '@/features/public-menu/styles/menu.css'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])

  // A mesma chamada do layout de `[slug]`: o cache() devolve o resultado já
  // buscado, sem segunda consulta. O notFound() fica porque layout e página
  // renderizam em paralelo, e a página não deve depender do layout para
  // responder 404.
  const menu = await getPublicMenu(slug)
  if (!menu) notFound()

  const theme = resolveTheme(menu.restaurant.theme)
  const parsedToken = typeof query.tag === 'string' ? tagTokenSchema.safeParse(query.tag) : null
  const tagToken = parsedToken?.success ? parsedToken.data : null

  // `overflow-hidden` e sem rolagem no documento: quem rola são os dois
  // roladores aninhados do feed. As variáveis do tema chegam pelo <style>
  // do layout de `[slug]`.
  return (
    <div
      data-menu={theme.presetId}
      data-density={theme.density}
      data-has-service-call={tagToken ? 'true' : undefined}
      className={`menu relative overflow-hidden ${ALL_THEME_FONT_VARIABLES}`}
    >
      <MenuFeed menu={menu} presetId={theme.presetId} tagToken={tagToken} />
    </div>
  )
}
