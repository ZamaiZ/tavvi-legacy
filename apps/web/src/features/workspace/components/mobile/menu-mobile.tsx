'use client'

import { useMemo, useRef, useState, useTransition, type TouchEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LuBookOpen, LuChevronRight, LuFolderPlus, LuPlus } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import type { RestaurantStatus } from '@/domain/restaurant'
import { PublishCard } from '../publish-card'
import { CategorySheet } from './category-sheet'
import { ItemEditorSheet } from './item-editor-sheet'
import { MenuMobileRow } from './menu-mobile-row'

type MenuFilter = 'all' | 'media' | 'unavailable' | 'hidden'
const FILTERS: readonly [MenuFilter, string][] = [['all', 'Todos'], ['media', 'Sem mídia'], ['unavailable', 'Indisponíveis'], ['hidden', 'Ocultos']]
const QUICK_CATEGORIES = ['Entradas', 'Pratos principais', 'Bebidas', 'Sobremesas']

function itemCountLabel(count: number) {
  return `${count} ${count === 1 ? 'item' : 'itens'}`
}

// Cardápio no celular (Tavvi Mobile.dc.html, bMenu): título, cartão de
// publicação, filtros e as categorias em grupos. "Nova categoria",
// "Adicionar item" e tocar no cabeçalho do grupo seguem o mesmo idioma; os
// modos, a busca e o ordenar ficam no desktop.
export function MenuMobile({
  restaurantId,
  status,
  publicUrl,
  logoPath,
  coverPath,
  categories,
  canEdit,
}: {
  restaurantId: string
  status: RestaurantStatus
  publicUrl: string
  logoPath: string | null
  coverPath: string | null
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
}) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const pullStart = useRef<{ x: number; y: number } | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const [filter, setFilter] = useState<MenuFilter>('all')
  const [categoryTarget, setCategoryTarget] = useState<{ categoryId: string | null; initialName?: string }>({ categoryId: null })
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [newItemCategoryId, setNewItemCategoryId] = useState<string | null>(null)
  const [newItemOpen, setNewItemOpen] = useState(false)

  const flatItems = useMemo(() => categories.flatMap((category) => category.items), [categories])
  const missingMedia = flatItems.filter((item) => item.missingMedia).length
  const visibleItemsCount = flatItems.filter((item) => item.isVisible).length
  const categoriesWithItems = categories.filter((category) => category.items.length > 0).length
  const counts: Record<MenuFilter, number> = {
    all: flatItems.length,
    media: missingMedia,
    unavailable: flatItems.filter((item) => !item.isAvailable).length,
    hidden: flatItems.filter((item) => !item.isVisible).length,
  }
  const groups = categories
    .map((category) => ({
      category,
      items: category.items.filter((item) => filter === 'all'
        || (filter === 'media' && item.missingMedia)
        || (filter === 'unavailable' && !item.isAvailable)
        || (filter === 'hidden' && !item.isVisible)),
    }))
    .filter((group) => filter === 'all' || group.items.length > 0)
  const editingCategory = categoryTarget.categoryId ? categories.find((category) => category.id === categoryTarget.categoryId) : undefined

  function openCategory(categoryId: string | null, initialName?: string) {
    setCategoryTarget({ categoryId, initialName })
    setCategoryOpen(true)
  }

  function openNewItem(categoryId: string) {
    setNewItemCategoryId(categoryId)
    setNewItemOpen(true)
  }

  // O chip do cartão aplica "Sem mídia" e leva até a lista.
  function showMissingMedia() {
    setFilter('media')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    listRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // Puxar para atualizar, como no cardápio do celular de antes.
  function onTouchStart(event: TouchEvent<HTMLElement>) {
    // Toque dentro de um sheet ou menu portado sobe até aqui pela árvore do
    // React; só conta o que está na página de fato.
    const target = event.target as HTMLElement
    if (window.scrollY > 0 || !event.currentTarget.contains(target) || target.closest('button,input,textarea,a,[role="switch"],select')) return
    pullStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = pullStart.current
    pullStart.current = null
    if (!start) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (dy > 100 && dy > Math.abs(dx) * 1.4) {
      // O indicador acompanha o refresh de verdade, e não um tempo fixo.
      startRefresh(() => router.refresh())
    }
  }

  return (
    <div className="tv-mp" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { pullStart.current = null }}>
      {refreshing ? <p role="status" className="tv-mp-refresh">Atualizando cardápio…</p> : null}

      <div className="tv-mp-titlebar">
        <h1 className="tv-mp-title">Cardápio</h1>
        {canEdit ? (
          <button type="button" className="tv-mp-action" aria-haspopup="dialog" onClick={() => openCategory(null)}>
            <LuFolderPlus aria-hidden="true" />Nova categoria
          </button>
        ) : null}
      </div>

      <PublishCard
        variant="mobile"
        restaurantId={restaurantId}
        status={status}
        publicUrl={publicUrl}
        canEdit={canEdit}
        missingMedia={missingMedia}
        visibleItemsCount={visibleItemsCount}
        categoriesWithItems={categoriesWithItems}
        hasBrandImages={Boolean(logoPath && coverPath)}
        onMissingMediaClick={showMissingMedia}
      />

      {flatItems.length > 0 ? (
        <div className="tv-mchips" role="group" aria-label="Filtrar itens">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className="tv-mchip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}<span>{counts[value]}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div ref={listRef} className="tv-mcats">
        {categories.length === 0 ? (
          <div className="tv-mempty">
            <span className="tv-mempty-icon" aria-hidden="true"><LuBookOpen /></span>
            <h2>Seu cardápio começa aqui</h2>
            <p>{canEdit ? 'Crie uma categoria e organize os primeiros pratos.' : 'O administrador ainda não montou o cardápio.'}</p>
            {canEdit ? (
              <div className="tv-mempty-chips">
                {QUICK_CATEGORIES.map((name) => (
                  <button key={name} type="button" className="tv-mchip" onClick={() => openCategory(null, name)}>{name}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : groups.length === 0 ? (
          <div className="tv-group tv-mnone">
            <strong>Nada encontrado</strong>
            <span>Ajuste o filtro para ver outros itens.</span>
          </div>
        ) : (
          groups.map(({ category, items }) => {
            const heading = (
              <>
                <span className="tv-mcat-name">{category.name}{!category.isVisible ? <small>Oculta</small> : null}</span>
                <span className="tv-mcat-count">{itemCountLabel(category.items.length)}{canEdit ? <LuChevronRight aria-hidden="true" /> : null}</span>
              </>
            )
            return (
              <section key={category.id} className="tv-mcat" aria-label={category.name}>
                {canEdit ? (
                  <button type="button" className="tv-mcat-head" aria-haspopup="dialog" aria-label={`Editar categoria ${category.name}`} onClick={() => openCategory(category.id)}>
                    {heading}
                  </button>
                ) : (
                  <div className="tv-mcat-head">{heading}</div>
                )}
                <div className="tv-mgroup">
                  {items.map((item) => (
                    <MenuMobileRow key={item.id} restaurantId={restaurantId} item={item} siblings={category.items} categories={categories} canEdit={canEdit} />
                  ))}
                  {category.items.length === 0 ? <p className="tv-mgroup-empty">Categoria vazia — não aparece no cardápio público.</p> : null}
                  {canEdit && filter === 'all' ? (
                    <button type="button" className="tv-madd" aria-haspopup="dialog" onClick={() => openNewItem(category.id)}>
                      <LuPlus aria-hidden="true" />Adicionar item
                    </button>
                  ) : null}
                </div>
              </section>
            )
          })
        )}
      </div>

      {canEdit ? (
        <>
          <CategorySheet
            restaurantId={restaurantId}
            category={editingCategory}
            initialName={categoryTarget.initialName}
            open={categoryOpen}
            onOpenChange={setCategoryOpen}
          />
          {newItemCategoryId ? (
            <ItemEditorSheet
              restaurantId={restaurantId}
              item={null}
              categoryId={newItemCategoryId}
              categories={categories}
              open={newItemOpen}
              onOpenChange={setNewItemOpen}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
