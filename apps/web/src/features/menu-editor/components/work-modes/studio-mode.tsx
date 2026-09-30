'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { LuPencil, LuPlus } from 'react-icons/lu'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { ALL_THEME_FONT_VARIABLES } from '@/lib/fonts'
import { resolveTheme } from '@/lib/theme/resolve'
import { useDocumentDark } from '@/lib/use-document-dark'
import { firstMedia, focalPosition, mediaPreviewUrl, priceLabel } from '../../lib/item-display'
import { StandaloneItemContextMenu } from '../item-context-menu'
import { ItemEditDialog } from '../item-edit-dialog'
import { NewCategoryButton } from '../new-category-button'
import { NewItemButton } from '../new-item-button'
import '@/features/public-menu/styles/menu.css'

// Estúdio (README §7.5, item 13): lista de 260 px agrupada por categoria (só
// organização, não filtra) e a prévia do prato no tema REAL do restaurante.
export function StudioMode({
  restaurantId,
  categories,
  canEdit,
  theme,
}: {
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
  theme: unknown
}) {
  const dark = useDocumentDark()
  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const items = categories.flatMap((category) => category.items)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null

  if (!selected) {
    return (
      <PanelEmptyState
        density="section"
        icon={<LuPlus />}
        title="Adicione o primeiro item"
        description="O estúdio mostra como cada prato vai aparecer para quem visita o cardápio."
        action={canEdit && categories[0]
          ? <NewItemButton restaurantId={restaurantId} categoryId={categories[0].id} appearance="chip" />
          : canEdit ? <NewCategoryButton restaurantId={restaurantId} appearance="chip" /> : undefined}
      />
    )
  }

  const category = categories.find((entry) => entry.id === selected.categoryId)
  const media = firstMedia(selected)
  const url = media ? mediaPreviewUrl(media) : null
  const style = (dark ? resolved.styleDark : resolved.styleLight) as CSSProperties

  return (
    <section className="tv-studio">
      <nav className="tv-studio-list" aria-label="Itens">
        <h2>Itens</h2>
        {categories.filter((entry) => entry.items.length > 0).map((entry) => (
          <div key={entry.id} className="tv-studio-group" role="group" aria-labelledby={`estudio-${entry.id}`}>
            <span id={`estudio-${entry.id}`} className="tv-studio-group-label">{entry.name}</span>
            {entry.items.map((item) => (
              <StandaloneItemContextMenu
                key={item.id}
                restaurantId={restaurantId}
                item={item}
                categories={categories}
                disabled={!canEdit}
                render={<button type="button" aria-current={item.id === selected.id ? 'true' : undefined} onClick={() => setSelectedId(item.id)} />}
              >
                <span>{item.name}</span>
                <small>{priceLabel(item)}</small>
              </StandaloneItemContextMenu>
            ))}
          </div>
        ))}
      </nav>

      <div className="tv-studio-preview">
        <h2>Prévia ao vivo</h2>
        <article className={`menu tv-studio-card ${ALL_THEME_FONT_VARIABLES}`} style={style} aria-label={`Prévia de ${selected.name}`}>
          <div className="tv-studio-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {media && url ? <img src={url} alt="" style={{ objectPosition: focalPosition(media) }} /> : null}
          </div>
          <div className="tv-studio-info">
            {category ? <small className="menu-muted">{category.name}</small> : null}
            <strong className="menu-display">{selected.name}</strong>
            {selected.description ? <p className="menu-muted">{selected.description}</p> : null}
            <b className="menu-accent">{priceLabel(selected)}</b>
          </div>
        </article>
        {canEdit ? (
          <>
            <button type="button" className="tv-pbtn is-primary" onClick={() => setEditorOpen(true)}>
              <LuPencil aria-hidden="true" />Editar item
            </button>
            <ItemEditDialog key={selected.id} item={selected} categories={categories} open={editorOpen} onOpenChange={setEditorOpen} />
          </>
        ) : null}
      </div>
    </section>
  )
}
