'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { MenuItemDTO, PublicMenuDTO } from '@/domain/menu'
import { activeGoogleReviewUrl } from '@/domain/restaurant'
import { formatCents, priceSummary } from '@/lib/money'
import { publicMediaUrl } from '@/lib/media-url'
import { FeedbackSheet } from './feedback-sheet'
import { MenuCover } from './menu-cover'
import { MenuDetails } from './menu-details'
import { RequestServiceCall } from './request-service-call'

export function MenuCatalog({
  menu,
  presetId,
  presentation,
  tagToken,
}: {
  menu: PublicMenuDTO
  presetId: string
  presentation: 'catalog-list' | 'catalog-grid'
  tagToken?: string | null
}) {
  const [activeCategoryId, setActiveCategoryId] = useState(menu.categories[0]?.id ?? null)
  const [detailsItem, setDetailsItem] = useState<MenuItemDTO | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const flowRef = useRef<HTMLDivElement>(null)
  const menuScreenRef = useRef<HTMLDivElement>(null)
  const menuNavRef = useRef<HTMLElement>(null)
  const categoryNavListRef = useRef<HTMLUListElement>(null)
  const categoryRefs = useRef(new Map<string, HTMLElement>())
  const isGrid = presentation === 'catalog-grid'
  const categories = menu.categories

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const nextId = (visible[0]?.target as HTMLElement | undefined)?.dataset.categoryId
        if (nextId) setActiveCategoryId(nextId)
      },
      { root: menuScreenRef.current, rootMargin: '-20% 0px -62% 0px', threshold: 0 },
    )
    for (const section of categoryRefs.current.values()) observer.observe(section)
    return () => observer.disconnect()
  }, [categories])

  useEffect(() => {
    const list = categoryNavListRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!list || !selected) return

    const listRect = list.getBoundingClientRect()
    const selectedRect = selected.getBoundingClientRect()
    const left = list.scrollLeft + selectedRect.left - listRect.left - (list.clientWidth - selectedRect.width) / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({
      left: Math.max(0, Math.min(left, list.scrollWidth - list.clientWidth)),
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [activeCategoryId])

  function scrollToCategory(categoryId: string) {
    const section = categoryRefs.current.get(categoryId)
    const menuScreen = menuScreenRef.current
    if (!section || !menuScreen) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sectionTop = section.getBoundingClientRect().top
    const screenTop = menuScreen.getBoundingClientRect().top
    const navHeight = menuNavRef.current?.getBoundingClientRect().height ?? 0
    const top = menuScreen.scrollTop + sectionTop - screenTop - navHeight
    menuScreen.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
    setActiveCategoryId(categoryId)
  }

  function viewMenu() {
    const flow = flowRef.current
    if (!flow) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    flow.scrollTo({
      left: flow.clientWidth,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <>
      {tagToken ? <RequestServiceCall token={tagToken} /> : null}

      <div ref={flowRef} className="menu-catalog-flow">
        <section className="menu-catalog-screen menu-catalog-intro-screen" aria-label={`Apresentação de ${menu.restaurant.name}`}>
          <MenuCover
            variant="catalog"
            name={menu.restaurant.name}
            description={menu.restaurant.description}
            logoPath={menu.restaurant.logoPath}
            coverPath={menu.restaurant.coverPath}
            contact={menu.restaurant.contact}
            googleReviewUrl={activeGoogleReviewUrl(menu.restaurant.contact)}
            hasDishes={categories.length > 0}
            onViewMenu={viewMenu}
            onOpenFeedback={() => setFeedbackOpen(true)}
          />

          <p className="menu-catalog-swipe-hint">Deslize para ver o cardápio <span aria-hidden="true">&rarr;</span></p>
        </section>

        <div ref={menuScreenRef} className="menu-catalog-screen menu-catalog-menu-screen">
          {categories.length > 0 ? (
            <nav ref={menuNavRef} className="menu-catalog-nav" aria-label="Categorias do cardápio">
              <div className="menu-catalog-nav-inner">
                <ul ref={categoryNavListRef} className="menu-catalog-nav-list">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <button
                        type="button"
                        className="menu-catalog-chip"
                        aria-current={activeCategoryId === category.id ? 'location' : undefined}
                        onClick={() => scrollToCategory(category.id)}
                      >
                        {category.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          ) : (
            <main className="menu-catalog-empty-main">
              <div className="menu-catalog-empty" role="status">
                <span className="menu-catalog-empty-mark" aria-hidden="true" />
                <h2 className="menu-display">O cardápio está sendo montado</h2>
                <p>Volte daqui a pouco, ou chame alguém da casa.</p>
              </div>
            </main>
          )}

          {categories.length > 0 ? (
            <main className={`menu-catalog-content ${isGrid ? 'is-grid' : 'is-list'}`}>
              {categories.map((category, categoryIndex) => (
                <section
                  key={category.id}
                  id={`menu-category-${category.id}`}
                  data-category-id={category.id}
                  ref={(element) => {
                    if (element) categoryRefs.current.set(category.id, element)
                    else categoryRefs.current.delete(category.id)
                  }}
                  className="menu-catalog-category"
                  aria-labelledby={`menu-category-title-${category.id}`}
                >
                  <header className="menu-catalog-category-heading">
                    <span className="menu-catalog-category-index">{String(categoryIndex + 1).padStart(2, '0')}</span>
                    <div>
                      <h2 id={`menu-category-title-${category.id}`} className="menu-display">{category.name}</h2>
                      {category.description ? <p>{category.description}</p> : null}
                    </div>
                  </header>
                  <ul className={`menu-catalog-items ${isGrid ? 'is-grid' : 'is-list'}`}>
                    {category.items.map((item) => (
                      <CatalogItem
                        key={item.id}
                        item={item}
                        layout={presentation}
                        onOpen={() => setDetailsItem(item)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </main>
          ) : null}
        </div>
      </div>

      <MenuDetails item={detailsItem} presetId={presetId} onClose={() => setDetailsItem(null)} />
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

function CatalogItem({
  item,
  layout,
  onOpen,
}: {
  item: MenuItemDTO
  layout: 'catalog-list' | 'catalog-grid'
  onOpen: () => void
}) {
  const visualMedia = item.media.find((media) => media.kind === 'image')
    ?? item.media.find((media) => media.posterPath)
  const imagePath = visualMedia?.kind === 'image'
    ? visualMedia.storagePath
    : visualMedia?.posterPath ?? null
  const price = priceSummary(item)
  const hasDetails = Boolean(item.description || item.variants.length > 0)

  const content = (
    <>
      <span className="menu-catalog-item-media">
        {imagePath ? (
          <Image
            src={publicMediaUrl('image', imagePath)}
            alt=""
            fill
            sizes={layout === 'catalog-grid'
              ? '(max-width: 359px) 100vw, (max-width: 767px) 50vw, 33vw'
              : '(max-width: 767px) 72px, 88px'}
            className="object-cover"
            style={{
              objectPosition: visualMedia
                ? `${visualMedia.focalX * 100}% ${visualMedia.focalY * 100}%`
                : undefined,
            }}
          />
        ) : (
          <span className="menu-catalog-item-placeholder" aria-hidden="true" />
        )}
        {!item.isAvailable ? <span className="menu-catalog-sold-out">Esgotado</span> : null}
      </span>

      <span className="menu-catalog-item-copy">
        <span className="menu-catalog-item-topline">
          <strong className="menu-display">{item.name}</strong>
          <span className="menu-catalog-price">
            {price.from ? <small>A partir de</small> : null}
            {formatCents(price.cents)}
          </span>
        </span>
        {item.description ? <span className="menu-catalog-item-description">{item.description}</span> : null}
        {item.dietaryTags.length > 0 ? (
          <span className="menu-catalog-tags">
            {item.dietaryTags.map((tag) => <span key={tag}>{tag}</span>)}
          </span>
        ) : null}
        {hasDetails ? (
          <span className="menu-catalog-item-more">
            {item.variants.length > 0 ? 'Ver opções' : 'Ver detalhes'}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <li className="menu-catalog-item">
      {hasDetails ? (
        <button type="button" className="menu-catalog-item-trigger" aria-haspopup="dialog" onClick={onOpen}>
          {content}
        </button>
      ) : (
        <article className="menu-catalog-item-static">{content}</article>
      )}
    </li>
  )
}
