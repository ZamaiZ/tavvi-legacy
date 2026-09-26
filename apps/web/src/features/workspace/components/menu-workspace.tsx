'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LuArrowDownUp, LuGrid2X2, LuList, LuSearch } from 'react-icons/lu'
import { RiBookOpenLine, RiFolderAddLine, RiSearchLine } from 'react-icons/ri'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import type { RestaurantStatus } from '@/domain/restaurant'
import { CategorySection } from '@/features/menu-editor/components/category-section'
import { ItemRow } from '@/features/menu-editor/components/item-row'
import { NewCategoryButton } from '@/features/menu-editor/components/new-category-button'
import { NewItemButton } from '@/features/menu-editor/components/new-item-button'
import { PublishBar } from './publish-bar'
import { MenuWorkModes, type MenuWorkMode } from '@/features/menu-editor/components/menu-work-modes'
import { Button } from '@/components/ui/button'
import { PanelEmptyState } from './panel-empty-state'

type MenuView = 'list' | 'index' | 'grid' | MenuWorkMode
type MenuFilter = 'all' | 'media' | 'unavailable' | 'hidden'

const viewLabels: Record<MenuView, string> = {
  list: 'Lista',
  index: 'Índice',
  grid: 'Grade',
  studio: 'Estúdio',
  board: 'Quadro',
  spreadsheet: 'Planilha',
  sequence: 'Sequência',
  service: 'Serviço',
}

export function MenuWorkspace({
  restaurantId,
  restaurantName,
  status,
  publicUrl,
  logoPath,
  coverPath,
  categories,
  canEdit,
}: {
  restaurantId: string
  restaurantName: string
  status: RestaurantStatus
  publicUrl: string
  logoPath: string | null
  coverPath: string | null
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
}) {
  const router = useRouter()
  const pullStart = useRef<{ x: number; y: number } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<MenuView>('list')
  const [filter, setFilter] = useState<MenuFilter>('all')
  const [query, setQuery] = useState('')
  const [reorderMode, setReorderMode] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(`tv_menu_view_${restaurantId}`)
    if (saved === 'list' || saved === 'index' || saved === 'grid' || saved === 'sequence' || (canEdit && ['studio', 'board', 'spreadsheet', 'service'].includes(saved))) setView(saved as MenuView)
  }, [restaurantId])

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

  const filteredCategories = categories.map((category) => {
    const items = category.items.filter((item) => {
      const matchesQuery = `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))
      const matchesFilter = filter === 'all'
        || (filter === 'media' && item.missingMedia)
        || (filter === 'unavailable' && !item.isAvailable)
        || (filter === 'hidden' && !item.isVisible)
      return matchesQuery && matchesFilter
    })
    return { ...category, items }
  }).filter((category) => category.items.length > 0 || (!query && filter === 'all' && category.items.length === 0))

  const showReorder = canEdit && query.trim() === '' && filter === 'all'
  const activeReorderMode = reorderMode && showReorder
  const workMode = (['studio', 'board', 'spreadsheet', 'sequence', 'service'] as string[]).includes(view)
  const verModes: MenuView[] = ['list', 'index', 'grid']
  const workModes: MenuView[] = canEdit ? ['studio', 'board', 'spreadsheet', 'sequence', 'service'] : ['sequence']

  function onTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (window.scrollY > 0 || (event.target as HTMLElement).closest('button,input,textarea,a,[role="switch"]')) return
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

  return (
    <main className="tv-menu-page">
      <header className="tv-menu-heading">
        <div>
          <div className="tv-menu-eyebrow"><span /> CARDÁPIO</div>
          <h1>{restaurantName}<b>.</b></h1>
          <p>Organize os pratos que seus clientes vão encontrar.</p>
        </div>
        {canEdit && categories.length > 0 ? <NewCategoryButton restaurantId={restaurantId} /> : null}
      </header>

      <PublishBar
        restaurantId={restaurantId}
        status={status}
        publicUrl={publicUrl}
        canEdit={canEdit}
        missingMedia={missingMedia}
        visibleItemsCount={visibleItemsCount}
        categoriesWithItems={categoriesWithItems}
        hasBrandImages={Boolean(logoPath && coverPath)}
        onMissingMediaClick={() => setFilter('media')}
      />

      <section className="tv-menu-workspace" aria-label="Gerenciar cardápio" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { pullStart.current = null }}>
        {refreshing ? <p role="status" className="tv-menu-refresh">Atualizando cardápio…</p> : null}
        <div className="tv-menu-toolbar">
          <div className="tv-menu-mode-groups">
          <div className="tv-menu-views" role="group" aria-label="Ver">
            <span className="tv-menu-group-label">Ver</span>
            {verModes.map((mode) => {
              const Icon = mode === 'list' ? LuList : mode === 'index' ? LuArrowDownUp : LuGrid2X2
              return <button key={mode} type="button" aria-pressed={view === mode} onClick={() => chooseView(mode)}><Icon aria-hidden="true" /><span>{viewLabels[mode]}</span></button>
            })}
          </div>
          <div className="tv-menu-views tv-menu-work-views" role="group" aria-label="Trabalhar">
            <span className="tv-menu-group-label">Trabalhar</span>
            {workModes.map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => chooseView(mode)}><span>{viewLabels[mode]}</span>{mode === 'sequence' && !canEdit ? <small>leitura</small> : null}</button>)}
          </div>
          </div>
          {!workMode ? <label className="tv-menu-search"><LuSearch aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar prato ou descrição" aria-label="Buscar prato ou descrição" /></label> : null}
          {!workMode && canEdit ? <button type="button" className={`tv-menu-reorder-toggle${activeReorderMode ? ' is-active' : ''}`} aria-pressed={activeReorderMode} disabled={!showReorder} onClick={() => setReorderMode((active) => !active)}>Ordenar</button> : null}
          {canEdit && categories.length === 0 ? <NewCategoryButton restaurantId={restaurantId} label="Nova categoria" /> : null}
        </div>

        {!workMode ? <div className="tv-menu-filters" role="group" aria-label="Filtrar itens">
          {([
            ['all', 'Todos'], ['media', 'Sem mídia'], ['unavailable', 'Indisponíveis'], ['hidden', 'Ocultos'],
          ] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{counts[value]}</span></button>)}
        </div> : null}

        {workMode ? <MenuWorkModes
          mode={view as MenuWorkMode}
          restaurantId={restaurantId}
          categories={categories}
          canEdit={canEdit}
          onManageHiddenItems={() => { setQuery(''); chooseView('list'); setFilter('hidden') }}
          onReviewMenu={() => { setQuery(''); chooseView('list'); setFilter('all') }}
        /> : categories.length === 0 ? (
          <PanelEmptyState
            density="page"
            icon={<RiBookOpenLine />}
            title="Seu cardápio começa aqui"
            description={canEdit ? 'Crie uma categoria e organize os primeiros pratos.' : 'O administrador ainda não montou o cardápio.'}
            action={canEdit ? <div className="tv-menu-quick-categories">{['Entradas', 'Pratos principais', 'Bebidas', 'Sobremesas'].map((name) => <NewCategoryButton key={name} restaurantId={restaurantId} label={name} initialName={name} variant="outline" />)}</div> : undefined}
          />
        ) : filteredCategories.length === 0 ? (
          <PanelEmptyState
            density="section"
            icon={<RiSearchLine />}
            title="Nenhum item encontrado"
            description="Tente outra busca ou limpe os filtros para voltar a ver o cardápio."
            action={<Button type="button" variant="outline" size="sm" onClick={() => { setQuery(''); setFilter('all') }}>Limpar busca e filtros</Button>}
          />
        ) : (
          <div className={view === 'index' ? 'tv-menu-index-layout' : undefined}>
            {view === 'index' ? <nav className="tv-menu-index" aria-label="Índice de categorias">{filteredCategories.map((category) => <a key={category.id} href={`#categoria-${category.id}`}><span>{category.name}</span><small>{category.items.length}</small></a>)}</nav> : null}
          <div className={view === 'grid' ? 'tv-menu-category-list is-grid' : 'tv-menu-category-list'}>
            {filteredCategories.map((category) => {
              const categoryIndex = categories.findIndex((entry) => entry.id === category.id)
              const categoryItems = category.items
              const originalCategoryItems = categories.find((entry) => entry.id === category.id)?.items ?? categoryItems
              return <CategorySection
                key={category.id}
                restaurantId={restaurantId}
                category={category}
                index={categoryIndex}
                all={categories}
                canEdit={canEdit}
                canReorder={showReorder}
              >
                {categoryItems.length === 0 ? (
                  <PanelEmptyState
                    density="compact"
                    icon={<RiFolderAddLine />}
                    title="Categoria sem itens"
                    description={category.isVisible ? 'Esta categoria ainda está vazia e não aparece no cardápio público.' : 'Categorias vazias não aparecem no cardápio público.'}
                    action={canEdit ? <NewItemButton restaurantId={restaurantId} categoryId={category.id} label="Adicionar primeiro item" variant="outline" /> : undefined}
                  />
                ) : (
                  <>
                    {categoryItems.map((item) => {
                      const itemIndex = originalCategoryItems.findIndex((entry) => entry.id === item.id)
                      return <ItemRow key={item.id} restaurantId={restaurantId} item={item} index={itemIndex} all={originalCategoryItems} categories={categories} canEdit={canEdit} canReorder={showReorder} reorderMode={activeReorderMode} presentation={view === 'grid' ? 'grid' : 'list'} />
                    })}
                    {canEdit ? <div className="tv-menu-add-item"><NewItemButton restaurantId={restaurantId} categoryId={category.id} label="Adicionar item" /></div> : null}
                  </>
                )}
              </CategorySection>
            })}
          </div>
          </div>
        )}
      </section>
    </main>
  )
}
