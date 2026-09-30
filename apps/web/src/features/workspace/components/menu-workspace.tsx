'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { LuArrowDownUp, LuArrowUpDown, LuBookOpen, LuFolderPlus, LuLayoutGrid, LuList, LuSearch, LuSparkles } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import type { RestaurantStatus } from '@/domain/restaurant'
import { CategorySection } from '@/features/menu-editor/components/category-section'
import { ItemCard } from '@/features/menu-editor/components/item-card'
import { ItemRow } from '@/features/menu-editor/components/item-row'
import { MenuWorkModes, type MenuWorkMode } from '@/features/menu-editor/components/menu-work-modes'
import { NewCategoryButton } from '@/features/menu-editor/components/new-category-button'
import { NewItemButton } from '@/features/menu-editor/components/new-item-button'
import { PanelEmptyState } from './panel-empty-state'
import { PublishCard } from './publish-card'

type MenuView = 'list' | 'index' | 'grid' | MenuWorkMode
type MenuFilter = 'all' | 'media' | 'unavailable' | 'hidden'

const VIEW_LABELS: Record<MenuView, string> = {
  list: 'Lista', index: 'Índice', grid: 'Grade',
  studio: 'Estúdio', board: 'Quadro', spreadsheet: 'Planilha', sequence: 'Sequência', service: 'Serviço',
}
const VIEW_ICONS = { list: LuList, index: LuArrowDownUp, grid: LuLayoutGrid } as const
const VER_MODES = ['list', 'index', 'grid'] as const
const WORK_MODES: readonly MenuWorkMode[] = ['studio', 'board', 'spreadsheet', 'sequence', 'service']
const READER_WORK_MODES: readonly MenuWorkMode[] = ['sequence']
const FILTERS: readonly [MenuFilter, string][] = [['all', 'Todos'], ['media', 'Sem mídia'], ['unavailable', 'Indisponíveis'], ['hidden', 'Ocultos']]
const QUICK_CATEGORIES = ['Entradas', 'Pratos principais', 'Bebidas', 'Sobremesas']
const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

function savedView(value: string | null, canEdit: boolean): MenuView | null {
  if (value === 'list' || value === 'index' || value === 'grid' || value === 'sequence') return value
  if (canEdit && (value === 'studio' || value === 'board' || value === 'spreadsheet' || value === 'service')) return value
  return null
}

// Cardápio do painel (Tavvi Web.dc.html, bloco rMenu; README §7.5).
export function MenuWorkspace({
  restaurantId,
  restaurantName,
  status,
  publicUrl,
  logoPath,
  coverPath,
  theme,
  onboardingCompleted,
  categories,
  canEdit,
}: {
  restaurantId: string
  restaurantName: string
  status: RestaurantStatus
  publicUrl: string
  logoPath: string | null
  coverPath: string | null
  /** Tema do cardápio público, para a prévia do Estúdio. */
  theme: unknown
  onboardingCompleted: boolean
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const pullStart = useRef<{ x: number; y: number } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<MenuView>('list')
  const [filter, setFilter] = useState<MenuFilter>('all')
  const [query, setQuery] = useState('')
  const [reorderMode, setReorderMode] = useState(false)
  const [indexSelection, setIndexSelection] = useState('all')

  useEffect(() => {
    const saved = savedView(window.localStorage.getItem(`tv_menu_view_${restaurantId}`), canEdit)
    if (saved) setView(saved)
  }, [restaurantId, canEdit])

  function chooseView(next: MenuView) {
    setView(next)
    window.localStorage.setItem(`tv_menu_view_${restaurantId}`, next)
  }

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

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
  const filteredCategories = categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const matchesQuery = `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
        const matchesFilter = filter === 'all'
          || (filter === 'media' && item.missingMedia)
          || (filter === 'unavailable' && !item.isAvailable)
          || (filter === 'hidden' && !item.isVisible)
        return matchesQuery && matchesFilter
      }),
    }))
    .filter((category) => category.items.length > 0 || (!normalizedQuery && filter === 'all'))

  // Ordenar só faz sentido com a lista inteira à vista.
  const showReorder = canEdit && normalizedQuery === '' && filter === 'all'
  const activeReorderMode = reorderMode && showReorder
  const workMode = (WORK_MODES as readonly string[]).includes(view)
  const workModes = canEdit ? WORK_MODES : READER_WORK_MODES
  // A categoria escolhida no Índice some quando a busca ou o filtro a
  // esvaziam; aí o Índice volta para "Todos".
  const selectedCategory = view === 'index' && filteredCategories.some((category) => category.id === indexSelection) ? indexSelection : 'all'
  const shownCategories = selectedCategory === 'all' ? filteredCategories : filteredCategories.filter((category) => category.id === selectedCategory)
  const filteredItemCount = filteredCategories.reduce((total, category) => total + category.items.length, 0)

  function onTouchStart(event: React.TouchEvent<HTMLElement>) {
    // Toque dentro de um sheet ou menu portado sobe até aqui pela árvore do
    // React; só conta o que está na página de fato.
    const target = event.target as HTMLElement
    if (window.scrollY > 0 || !event.currentTarget.contains(target) || target.closest('button,input,textarea,a,[role="switch"],select')) return
    pullStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  function onTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = pullStart.current
    pullStart.current = null
    if (!start) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (dy > 100 && dy > Math.abs(dx) * 1.4) {
      setRefreshing(true)
      router.refresh()
      window.setTimeout(() => setRefreshing(false), 900)
    }
  }

  function renderCategory(shown: OwnerMenuCategoryDTO) {
    const index = categories.findIndex((entry) => entry.id === shown.id)
    const full = categories[index] ?? shown
    return (
      <CategorySection
        key={shown.id}
        restaurantId={restaurantId}
        category={full}
        shownCount={shown.items.length}
        index={index}
        all={categories}
        canEdit={canEdit}
        reorderMode={activeReorderMode && selectedCategory === 'all'}
      >
        {shown.items.length === 0 ? (
          <PanelEmptyState
            density="compact"
            icon={<LuFolderPlus />}
            title="Categoria sem itens"
            description={full.isVisible ? 'Esta categoria ainda está vazia e não aparece no cardápio público.' : 'Categorias vazias não aparecem no cardápio público.'}
            action={canEdit ? <NewItemButton restaurantId={restaurantId} categoryId={shown.id} label="Adicionar primeiro item" appearance="chip" /> : undefined}
          />
        ) : (
          <>
            {view === 'grid' ? (
              <div className="tv-grid">
                {shown.items.map((item) => <ItemCard key={item.id} restaurantId={restaurantId} item={item} siblings={full.items} categories={categories} canEdit={canEdit} reorderMode={activeReorderMode} />)}
              </div>
            ) : (
              shown.items.map((item) => <ItemRow key={item.id} restaurantId={restaurantId} item={item} siblings={full.items} categories={categories} canEdit={canEdit} reorderMode={activeReorderMode} />)
            )}
            {canEdit ? <div className="tv-cat-foot"><NewItemButton restaurantId={restaurantId} categoryId={shown.id} /></div> : null}
          </>
        )}
      </CategorySection>
    )
  }

  return (
    <main className="tv-mpage">
      <header className="tv-mhead">
        <div className="tv-mhead-copy">
          <span className="tv-mhead-eyebrow">Cardápio</span>
          <h1>{restaurantName}</h1>
          <p>Organize os pratos que seus clientes vão encontrar.</p>
        </div>
        {canEdit ? (
          <div className="tv-mhead-actions">
            {!onboardingCompleted ? (
              <Link href={`/restaurantes/${restaurantId}/comecar`} className="tv-pbtn">
                <LuSparkles className="tv-pbtn-gold" aria-hidden="true" />Primeiros passos
              </Link>
            ) : null}
            <NewCategoryButton restaurantId={restaurantId} />
          </div>
        ) : null}
      </header>

      <PublishCard
        restaurantId={restaurantId}
        status={status}
        publicUrl={publicUrl}
        canEdit={canEdit}
        missingMedia={missingMedia}
        visibleItemsCount={visibleItemsCount}
        categoriesWithItems={categoriesWithItems}
        hasBrandImages={Boolean(logoPath && coverPath)}
        onMissingMediaClick={() => {
          if (workMode) chooseView('list')
          setFilter('media')
        }}
      />

      <section className="tv-mwork" aria-label="Gerenciar cardápio" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { pullStart.current = null }}>
        {refreshing ? <p role="status" className="tv-menu-refresh">Atualizando cardápio…</p> : null}

        <div className="tv-mbar">
          <div className="tv-seg" role="group" aria-label="Ver">
            <span className="tv-seg-label" aria-hidden="true">Ver</span>
            {VER_MODES.map((mode) => {
              const Icon = VIEW_ICONS[mode]
              return <button key={mode} type="button" aria-pressed={view === mode} onClick={() => chooseView(mode)}><Icon aria-hidden="true" />{VIEW_LABELS[mode]}</button>
            })}
          </div>
          <div className="tv-seg" role="group" aria-label="Trabalhar">
            <span className="tv-seg-label" aria-hidden="true">Trabalhar</span>
            {workModes.map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => chooseView(mode)}>{VIEW_LABELS[mode]}</button>)}
          </div>
          <span className="tv-mbar-spacer" aria-hidden="true" />
          {!workMode ? (
            <>
              <label className="tv-msearch">
                <LuSearch aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar prato ou descrição" aria-label="Buscar prato ou descrição" />
              </label>
              {canEdit ? (
                <button
                  type="button"
                  className={`tv-pbtn tv-mreorder${activeReorderMode ? ' is-active' : ''}`}
                  aria-pressed={activeReorderMode}
                  disabled={!showReorder}
                  title={showReorder ? undefined : 'Limpe a busca e os filtros para ordenar'}
                  onClick={() => setReorderMode((on) => !on)}
                >
                  <LuArrowUpDown aria-hidden="true" />Ordenar
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {!workMode ? (
          <div className="tv-mfilters" role="group" aria-label="Filtrar itens">
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" className="tv-chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}<span>{counts[value]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {workMode ? (
          <MenuWorkModes
            mode={view as MenuWorkMode}
            restaurantId={restaurantId}
            categories={categories}
            canEdit={canEdit}
            theme={theme}
            onManageHiddenItems={() => { setQuery(''); chooseView('list'); setFilter('hidden') }}
            onReviewMenu={() => { setQuery(''); chooseView('list'); setFilter('all') }}
          />
        ) : categories.length === 0 ? (
          <PanelEmptyState
            density="page"
            icon={<LuBookOpen />}
            title="Seu cardápio começa aqui"
            description={canEdit ? 'Crie uma categoria e organize os primeiros pratos.' : 'O administrador ainda não montou o cardápio.'}
            action={canEdit ? <>{QUICK_CATEGORIES.map((name) => <NewCategoryButton key={name} restaurantId={restaurantId} label={name} initialName={name} appearance="chip" />)}</> : undefined}
          />
        ) : filteredCategories.length === 0 ? (
          <PanelEmptyState
            density="section"
            icon={<LuSearch />}
            title="Nenhum item encontrado"
            description="Tente outra busca ou limpe os filtros para voltar a ver o cardápio."
            action={<button type="button" className="tv-pbtn is-sm" onClick={() => { setQuery(''); setFilter('all') }}>Limpar busca e filtros</button>}
          />
        ) : (
          <div className={view === 'index' ? 'tv-mindex-layout' : undefined}>
            {view === 'index' ? (
              <nav className="tv-mindex" aria-label="Índice de categorias">
                <button type="button" aria-current={selectedCategory === 'all' ? 'true' : undefined} onClick={() => setIndexSelection('all')}>
                  <span>Todos</span><small>{filteredItemCount}</small>
                </button>
                {filteredCategories.map((category) => (
                  <button key={category.id} type="button" aria-current={selectedCategory === category.id ? 'true' : undefined} onClick={() => setIndexSelection(category.id)}>
                    <span>{category.name}</span><small>{category.items.length}</small>
                  </button>
                ))}
              </nav>
            ) : null}
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={view === 'index' ? `index-${selectedCategory}` : view}
                className="tv-mlist"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE }}
              >
                {shownCategories.map(renderCategory)}
              </m.div>
            </AnimatePresence>
          </div>
        )}
      </section>
    </main>
  )
}
