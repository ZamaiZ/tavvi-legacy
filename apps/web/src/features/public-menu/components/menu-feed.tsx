'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MenuItemDTO, PublicMenuDTO } from '@/domain/menu'
import { activeGoogleReviewUrl } from '@/domain/restaurant'
import { FeedbackSheet } from './feedback-sheet'
import { MenuCover } from './menu-cover'
import { MenuDetails } from './menu-details'
import { MenuDish } from './menu-dish'
import { MenuRail } from './menu-rail'

type FeedColumn = {
  item: MenuItemDTO
  categoryId: string
  categoryName: string
  categoryIndex: number
  categoryItemCount: number
}

export function MenuFeed({
  menu,
  presetId,
}: {
  menu: PublicMenuDTO
  presetId: string
}) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [detailsItem, setDetailsItem] = useState<MenuItemDTO | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Lista PLANA: a capa e todos os pratos de todas as categorias, em ordem.
  // Trocar o conjunto de colunas ao escolher categoria impediria a categoria
  // seguinte de entrar em sequência no deslize, e criaria um estado que
  // teria de ser mantido em sincronia com a posição do rolador.
  const columns: FeedColumn[] = menu.categories.flatMap((category) =>
    category.items.map((item, index) => ({
      item,
      categoryId: category.id,
      categoryName: category.name,
      categoryIndex: index,
      categoryItemCount: category.items.length,
    })),
  )

  // Índice 0 é a capa, então a coluna N do feed é `colunas[N - 1]`.
  const activeColumn = activeIndex > 0 ? columns[activeIndex - 1] : null

  // Cardápio publicado em que nenhum item tem mídia. Acontece com restaurante
  // que já estava no ar antes da Fase 4 — eles não são despublicados —,
  // então o caso é real e precisa de resposta.
  const isEmpty = columns.length === 0

  // `scrollIntoView` na coluna, e não `scrollTo` com um deslocamento em
  // pixels: é a API própria para contêiner com `scroll-snap`, e não depende
  // de `clientWidth`, que muda quando o aparelho gira.
  const scrollToColumn = useCallback((index: number) => {
    const feed = feedRef.current
    if (!feed) return
    const targetElement = feed.children[index] as HTMLElement | undefined
    if (!targetElement) return

    // `block: 'nearest'` é o que impede a chamada de rolar algum ancestral
    // na vertical de quebra.
    targetElement.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    })
  }, [])

  function handleScroll() {
    const feed = feedRef.current
    if (!feed) return
    const index = Math.round(feed.scrollLeft / feed.clientWidth)
    if (index !== activeIndex) setActiveIndex(index)
  }

  function scrollToCategory(categoryId: string) {
    const position = columns.findIndex((c) => c.categoryId === categoryId)
    if (position >= 0) scrollToColumn(position + 1)
  }

  // Teclado. O rolador nativo responde a seta quando tem foco, mas só depois
  // de a pessoa clicar nele. Ouvir na janela faz o cardápio ser navegável de
  // teclado desde o primeiro instante.
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      // Com uma folha aberta, ou com o foco num campo, as setas são do
      // texto, não do feed: sem isto, escrever o feedback andaria o cardápio.
      if (feedbackOpen || detailsItem) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        scrollToColumn(Math.min(activeIndex + 1, columns.length))
      }
      if (event.key === 'ArrowLeft') {
        scrollToColumn(Math.max(activeIndex - 1, 0))
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [activeIndex, columns.length, scrollToColumn, feedbackOpen, detailsItem])

  return (
    <>
      <MenuRail
        categories={menu.categories}
        active={activeColumn?.categoryId ?? null}
        onGoToCover={() => scrollToColumn(0)}
        onGoToCategory={scrollToCategory}
      />

      <div ref={feedRef} className="menu-feed" onScroll={handleScroll}>
        <MenuCover
          name={menu.restaurant.name}
          description={menu.restaurant.description}
          logoPath={menu.restaurant.logoPath}
          coverPath={menu.restaurant.coverPath}
          contact={menu.restaurant.contact}
          googleReviewUrl={activeGoogleReviewUrl(menu.restaurant.contact)}
          hasDishes={!isEmpty}
          onViewMenu={() => scrollToColumn(1)}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />

        {isEmpty ? (
          <section className="menu-column" aria-label="Cardápio em montagem">
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="menu-display text-[1.25rem] font-semibold">
                O cardápio está sendo montado
              </p>
              <p
                className="mt-2 text-[0.9375rem]"
                style={{ color: 'var(--m-muted)' }}
              >
                Volte daqui a pouco, ou chame alguém da casa.
              </p>
            </div>
          </section>
        ) : null}

        {columns.map((column, index) => (
          <MenuDish
            key={column.item.id}
            item={column.item}
            categoryName={column.categoryName}
            categoryIndex={column.categoryIndex}
            categoryItemCount={column.categoryItemCount}
            isFirst={index === 0}
            // A coluna atual e uma de cada lado. Fora disso a mídia não é
            // buscada: quarenta pratos seriam quarenta imagens de tela cheia
            // numa rede de restaurante.
            isNearViewport={Math.abs(index + 1 - activeIndex) <= 1}
            onViewDetails={() => setDetailsItem(column.item)}
          />
        ))}
      </div>

      <MenuDetails
        item={detailsItem}
        presetId={presetId}
        onClose={() => setDetailsItem(null)}
      />

      <FeedbackSheet
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        slug={menu.restaurant.slug}
        restaurantName={menu.restaurant.name}
        presetId={presetId}
      />
    </>
  )
}
