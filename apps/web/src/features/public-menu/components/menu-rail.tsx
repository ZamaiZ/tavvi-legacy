'use client'

import { useEffect, useState } from 'react'
import { RiCloseLine, RiComputerLine, RiHome4Line, RiMoonLine, RiRestaurantLine, RiSunLine } from 'react-icons/ri'
import type { MenuCategoryDTO } from '@/domain/menu'

type MenuAppearance = 'system' | 'light' | 'dark'
const MENU_THEME_KEY = 'tema-cardapio'
const appearanceOptions = {
  system: { label: 'Sistema', Icon: RiComputerLine, next: 'light' },
  light: { label: 'Claro', Icon: RiSunLine, next: 'dark' },
  dark: { label: 'Escuro', Icon: RiMoonLine, next: 'system' },
} as const

// Fixo no topo, sobre as colunas. É ele que resolve "oitenta itens, quero
// Bebidas": tocar numa categoria ROLA até a primeira coluna dela. Não existe
// "conjunto de colunas da categoria atual" a ser trocado — a categoria é uma
// propriedade da coluna, e o feed é uma lista plana.
//
// Ele abre COLAPSADO, desde a Fase 5. O primeiro desenho deixava os chips
// sempre à mostra: eles ocupavam a faixa inteira sobre a foto, e o último
// ficava fatiado por uma borda reta na direita.
export function MenuRail({
  categories,
  active,
  onGoToCover,
  onGoToCategory,
}: {
  categories: MenuCategoryDTO[]
  /** Id da categoria da coluna visível. `null` na capa. */
  active: string | null
  onGoToCover: () => void
  onGoToCategory: (categoryId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [appearance, setAppearance] = useState<MenuAppearance>('system')

  useEffect(() => {
    const stored = document.documentElement.dataset.menuAppearance
    if (stored === 'light' || stored === 'dark') setAppearance(stored)
  }, [])

  function cycleAppearance() {
    const next = appearanceOptions[appearance].next
    setAppearance(next)
    document.documentElement.dataset.menuAppearance = next
    try {
      localStorage.setItem(MENU_THEME_KEY, next)
    } catch {
      // A troca continua funcionando nesta visita quando o armazenamento falha.
    }
  }

  // Fecha sozinho ao deslizar para outro prato. Aberto, ele não fica no
  // caminho da foto — que é o ponto inteiro de ele ser colapsável.
  useEffect(() => {
    setIsOpen(false)
  }, [active])

  const currentName =
    categories.find((category) => category.id === active)?.name ?? 'Cardápio'

  const { label: appearanceLabel, Icon: AppearanceIcon, next } = appearanceOptions[appearance]

  return (
    <nav
      aria-label="Navegação do cardápio"
      data-open={isOpen}
      className="menu-rail menu-veil-top pointer-events-none absolute inset-x-0 top-0 z-20 pb-10 pt-3"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-[720px] items-center gap-2 px-3">
        {/* A pílula é SEMPRE visível, e informa: fechada, ela diz onde você
            está. Um hambúrguer mudo não diria. */}
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Fechar categorias' : 'Ver categorias'}
          className="menu-chip flex min-h-11 min-w-0 items-center gap-2 px-4 text-[0.8125rem] font-semibold"
        >
          {/* Os dois ícones ficam montados e se cruzam (menu.css), em vez de
              um trocar o outro de uma vez. */}
          <span className="menu-rail-toggle-icon shrink-0" aria-hidden="true">
            <RiRestaurantLine className="is-closed size-4" />
            <RiCloseLine className="is-open size-4" />
          </span>
          {isOpen ? null : (
            <span className="min-w-0 max-w-[9rem] truncate">{currentName}</span>
          )}
        </button>

        {/* `inert` tira os chips escondidos do foco e do leitor de tela. Sem
            ele, `Tab` passeia por botões invisíveis. */}
        <ul
          inert={!isOpen}
          className="menu-rail-list flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* "Início" é o PRIMEIRO chip, e não uma seta solta. Como seta, a
              função de voltar só aparecia fora da capa — ou seja, não existia
              na primeira tela, que é exatamente onde alguém se perde. Como
              item da lista, ela existe sempre. */}
          <li className="menu-rail-item" style={{ '--i': 0 } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => {
                onGoToCover()
                setIsOpen(false)
              }}
              className="menu-chip flex min-h-11 items-center gap-1.5 whitespace-nowrap px-4 text-[0.8125rem] font-semibold"
              style={
                active === null
                  ? {
                      background: 'var(--m-accent)',
                      color: 'var(--m-on-accent)',
                    }
                  : undefined
              }
            >
              <RiHome4Line className="size-4" aria-hidden="true" />
              Início
            </button>
          </li>

          {categories.map((category, index) => {
            const current = category.id === active
            return (
              <li
                key={category.id}
                className="menu-rail-item"
                style={{ '--i': index + 1 } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => {
                    onGoToCategory(category.id)
                    setIsOpen(false)
                  }}
                  aria-current={current ? 'true' : undefined}
                  className="menu-chip flex min-h-11 items-center whitespace-nowrap px-4 text-[0.8125rem] font-semibold"
                  // A categoria ativa usa `--m-accent` como fundo e
                  // `--m-on-accent` como texto. É o único lugar do cardápio
                  // em que o destaque vira SUPERFÍCIE, e é por isso que
                  // `--m-on-accent` precisa ser derivado contra ele — o
                  // guarda de contraste cobre exatamente este par.
                  style={
                    current
                      ? {
                          background: 'var(--m-accent)',
                          color: 'var(--m-on-accent)',
                        }
                      : undefined
                  }
                >
                  {category.name}
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={cycleAppearance}
          className="menu-chip menu-theme-toggle flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold"
          aria-label={`Tema: ${appearanceLabel}. Ativar ${appearanceOptions[next].label}`}
          title={`Tema: ${appearanceLabel}`}
        >
          <AppearanceIcon className="size-4" aria-hidden="true" />
          <span>{appearanceLabel}</span>
        </button>
      </div>
    </nav>
  )
}
