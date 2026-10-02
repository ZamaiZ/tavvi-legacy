import { notFound } from 'next/navigation'
import { PublicRestaurantProvider } from '@/features/public-menu/components/public-restaurant-context'
import { publicMediaUrl } from '@/lib/media-url'
import { resolveTheme } from '@/lib/theme/resolve'
import { currentTerritory } from '@/server/dal/auth'
import { getPublicMenu } from '@/server/dal/menu-read'

export default async function RestaurantMenuLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  // O catch-all `[...rest]` também recebe os caminhos internos de admin. e
  // painel. que não casam com rota nenhuma (`/admin/...`, `/admin/workspace/...`).
  // O cardápio só existe no domínio raiz: nos outros, a 404 é decidida aqui,
  // antes de ler o slug e sem consultar o banco. A 404 raiz mostra a variante
  // do território.
  if ((await currentTerritory()) !== 'site') notFound()

  const { slug } = await params
  const menu = await getPublicMenu(slug)

  // Restaurante inexistente, em rascunho, suspenso ou removido, e slug
  // inválido (inclusive o `/_404` das reescritas do proxy), caem todos aqui.
  // A resposta é a mesma para não revelar que o restaurante existe.
  if (!menu) notFound()

  const theme = resolveTheme(menu.restaurant.theme)

  return (
    <>
      {/* As variáveis das duas faces entram por folha de estilo embutida, e
          não por `style` no elemento, porque `style` não consegue expressar
          media query. A face escura só vale quando o aparelho do cliente
          pede escuro — e quem decide isso é o celular na mesa, não nós.

          O seletor é `[data-menu="<preset>"]`, e não uma classe, porque a
          folha de detalhes renderiza em portal, fora desta árvore: carregando
          o mesmo `data-menu`, ela é alcançada por esta regra onde quer que o
          portal a coloque, com a face escura junto.

          Fica no layout, e não na página, para a 404 "página" do cardápio
          (`not-found.tsx` deste segmento) vestir o mesmo tema. */}
      <style
        dangerouslySetInnerHTML={{
          __html: [
            `[data-menu="${theme.presetId}"]{${toCss(theme.styleLight)}}`,
            `@media (prefers-color-scheme: dark){`,
            `[data-menu="${theme.presetId}"]{${toCss(theme.styleDark)}}`,
            `}`,
          ].join(''),
        }}
      />
      <PublicRestaurantProvider
        value={{
          slug: menu.restaurant.slug,
          name: menu.restaurant.name,
          logoUrl: menu.restaurant.logoPath ? publicMediaUrl('image', menu.restaurant.logoPath) : null,
          presetId: theme.presetId,
        }}
      >
        {children}
      </PublicRestaurantProvider>
    </>
  )
}

// Os valores são cores em hexadecimal, comprimentos e nomes de variável de
// fonte — todos vindos dos presets no código ou já validados pelo
// `themeSchema` e pelo `isBaseInRange` antes de chegarem aqui. Nada vindo
// direto do cliente entra nesta string.
function toCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([nome, valor]) => `${nome}:${valor}`)
    .join(';')
}
