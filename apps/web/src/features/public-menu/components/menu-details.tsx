'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { MenuItemDTO } from '@/domain/menu'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { formatCents } from '@/lib/money'

// A descrição inteira e as variações moram aqui, e não sobre a foto. Texto
// longo empurrando a mídia é o que transforma um feed numa página comprida
// com imagem em cima.
export function MenuDetails({
  item,
  presetId,
  onClose,
}: {
  item: MenuItemDTO | null
  /** O mesmo `data-menu` da rota. Sem ele o portal sai com a cor do painel. */
  presetId: string
  onClose: () => void
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        // `data-menu` faz a folha de estilo embutida da rota alcançar este
        // elemento, que o portal põe no fim do body, FORA da árvore do
        // `.menu`. As variáveis do tema são declaradas no seletor
        // `[data-menu="<preset>"]` justamente porque `style` no elemento não
        // expressa media query — e é o mesmo motivo que faz a face escura
        // vir junto de graça aqui.
        data-menu={presetId}
        // `background` e `color` explícitos porque o SheetContent embute
        // `bg-popover text-popover-foreground`, que são cores do PAINEL.
        // As variáveis de FONTE também precisam vir, e não só as de cor.
        // `--m-font-display` vale `var(--tf-cormorant), serif`, e
        // `--tf-cormorant` é declarada pela classe do next/font no elemento
        // da rota — que o portal não tem acima de si. Sem estas classes a
        // declaração fica inválida em tempo de valor computado e a fonte cai
        // para a HERDADA, que é a de texto. Medido: o título saía em Inter.
        className={`menu max-h-[85dvh] overflow-y-auto ${ALL_THEME_FONT_VARIABLES}`}
        style={{ background: 'var(--m-base)', color: 'var(--m-ink)' }}
      >
        {item ? (
          <>
            <SheetHeader>
              {/* A cor vai no `style` porque o `SheetTitle` embute
                  `text-foreground` — token do PAINEL — e ele vence a herança
                  do contêiner. Aqui parece inofensivo, já que os dois são
                  quase brancos no escuro; mas Brasa e Neon têm face CLARA com
                  fundo quase preto, e nelas o `--foreground` claro do painel
                  daria texto preto sobre fundo preto. */}
              <SheetTitle
                className="menu-display text-[1.25rem] font-semibold"
                style={{ color: 'var(--m-ink)' }}
              >
                {item.name}
              </SheetTitle>
              {item.description ? (
                <SheetDescription
                  className="text-[0.9375rem] leading-relaxed"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {item.description}
                </SheetDescription>
              ) : null}
            </SheetHeader>

            {item.variants.length > 0 ? (
              <ul
                className="menu-line mt-6 divide-y px-4 pb-4"
                style={{ borderColor: 'var(--m-line)' }}
              >
                {item.variants.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <span style={{ color: 'var(--m-ink)' }}>
                      {variant.name}
                      {variant.isAvailable ? null : (
                        <span
                          className="ml-2 text-[0.8125rem]"
                          style={{ color: 'var(--m-muted)' }}
                        >
                          esgotado
                        </span>
                      )}
                    </span>
                    <span className="menu-accent shrink-0 font-semibold">
                      {formatCents(variant.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="menu-accent mt-6 px-4 pb-4 text-[1.125rem] font-semibold">
                {formatCents(item.basePriceCents)}
              </p>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
