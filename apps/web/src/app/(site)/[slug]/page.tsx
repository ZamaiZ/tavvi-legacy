import { notFound } from 'next/navigation'
import { MenuFeed } from '@/features/public-menu/components/menu-feed'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { resolveTheme } from '@/lib/theme/resolve'
import { getPublicMenu } from '@/server/dal/menu-read'
import '@/features/public-menu/styles/menu.css'

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const menu = await getPublicMenu(slug)

  // Restaurante inexistente, em rascunho, suspenso ou removido caem todos
  // aqui. A resposta é a mesma para não revelar que o restaurante existe.
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
          portal a coloque, com a face escura junto. */}
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

      {/* `overflow-hidden` e sem rolagem no documento: quem rola são os dois
          roladores aninhados do feed. */}
      <div
        data-menu={theme.presetId}
        data-density={theme.density}
        className={`menu relative overflow-hidden ${ALL_THEME_FONT_VARIABLES}`}
      >
        <MenuFeed menu={menu} presetId={theme.presetId} />
      </div>
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
