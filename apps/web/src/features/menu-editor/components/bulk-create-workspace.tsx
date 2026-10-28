'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LuArrowLeft, LuFolderPlus, LuList, LuPlus } from 'react-icons/lu'
import { MAX_ITEMS_PER_BATCH, type OwnerMenuCategoryDTO } from '@/domain/menu'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { BulkCategoryGroup } from './bulk-category-group'
import { useBulkMenuDraft } from './use-bulk-menu-draft'

export function BulkCreateWorkspace({
  restaurantId,
  categories,
  onBack,
}: {
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  onBack: () => void
}) {
  const router = useRouter()
  const [categoryFormOpen, setCategoryFormOpen] = useState(categories.length === 0)
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const draft = useBulkMenuDraft({ restaurantId, categories, onSaved: () => { router.refresh(); onBack() } })

  const categoriesForSelect = useMemo(() => [
    ...categories,
    ...draft.newCategories.map((category) => ({ ...category, position: categories.length + 1, isVisible: true, items: [] })),
  ], [categories, draft.newCategories])
  const waitingMediaIds = new Set(draft.rows.filter((row) => draft.inspectingItems.includes(row.id) || row.values.media.some((media) => (
    media.source.type === 'new' && (media.source.prep.status === 'queued' || media.source.prep.status === 'preparing')
  ))).map((row) => row.id))
  const waitingMediaCount = waitingMediaIds.size
  const invalidItemCount = draft.rows.filter((row) => !waitingMediaIds.has(row.id) && Boolean(draft.validation.errors[row.id])).length
  const readyItemCount = Math.max(0, draft.rows.length - invalidItemCount - waitingMediaCount)
  const hasUncommittedCategory = Boolean(categoryName.trim() || categoryDescription.trim())
  const hasMeaningfulDraft = draft.inspecting || hasUncommittedCategory || draft.newCategories.length > 0 || draft.rows.some((row) => {
    const values = row.values
    return row.values.categoryId !== row.initialCategoryId || Boolean(values.name.trim()) || Boolean(values.description.trim())
      || values.dietaryTags.length > 0 || values.media.length > 0 || values.variants.length > 0 || values.basePriceCents !== null
      || values.pricing !== 'single' || !values.isVisible || !values.isAvailable
  })

  useEffect(() => {
    if (draft.errorTick === 0 || !draft.validation.firstInvalidId) return
    const invalidId = draft.validation.firstInvalidId
    if (!invalidId.startsWith('category:')) {
      const row = draft.rows.find((entry) => entry.id === invalidId)
      if (row && !row.expanded) draft.setExpanded(row.id, true)
    }
    requestAnimationFrame(() => {
      const selector = invalidId.startsWith('category:')
        ? `[data-bulk-category="${invalidId.slice('category:'.length)}"]`
        : `[data-bulk-item="${invalidId}"]`
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [draft.errorTick, draft.rows, draft.setExpanded, draft.validation.firstInvalidId])

  function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.addCategory(categoryName, categoryDescription)) return
    setCategoryName('')
    setCategoryDescription('')
    setCategoryFormOpen(false)
  }

  function cancelCategory() {
    setCategoryName('')
    setCategoryDescription('')
    setCategoryFormOpen(false)
    draft.clearCategoryLimitError()
  }

  function back() {
    if (draft.busy) return
    if (hasMeaningfulDraft) setDiscardOpen(true)
    else onBack()
  }

  return (
    <section className="tv-bulk-workspace" aria-label="Criação em massa de itens">
      <div className="tv-bulk-workspace-head">
        <button type="button" className="tv-pbtn is-ghost" disabled={draft.busy} onClick={back}><LuArrowLeft aria-hidden="true" />Voltar ao cardápio</button>
        <div className="tv-bulk-workspace-title">
          <span className="tv-bulk-kicker"><LuList aria-hidden="true" />Montagem do cardápio</span>
          <h2>Adicionar vários itens</h2>
          <p>Organize pratos por categoria e complete os detalhes quando quiser.</p>
        </div>
        <div className="tv-bulk-totals" aria-label="Resumo do lote">
          <span><strong>{draft.rows.length}</strong>/{MAX_ITEMS_PER_BATCH} itens</span>
          <span><strong>{draft.newCategories.length}</strong> categorias novas</span>
        </div>
      </div>

      <div className="tv-bulk-toolbar">
        {!categoryFormOpen ? (
          <button type="button" className="tv-pbtn" disabled={draft.busy || !draft.canAddCategory} onClick={() => setCategoryFormOpen(true)}>
            <LuFolderPlus aria-hidden="true" />Nova categoria
          </button>
        ) : (
          <form className="tv-bulk-category-form" onSubmit={addCategory}>
            <div className="tv-bulk-category-form-copy">
              <strong>Nova categoria</strong>
              <span>Ela entra no cardápio junto com os itens deste lote.</span>
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Nome da categoria</span>
              <input className="tv-pinput" value={categoryName} maxLength={80} disabled={draft.busy} autoFocus={categories.length === 0 && draft.newCategories.length === 0} placeholder="Ex.: Massas artesanais" onChange={(event) => setCategoryName(event.target.value)} />
            </label>
            <label className="tv-pfield tv-bulk-category-description">
              <span className="tv-pfield-label">Descrição <span className="tv-pfield-help">opcional</span></span>
              <input className="tv-pinput" value={categoryDescription} maxLength={300} disabled={draft.busy} placeholder="Uma frase para apresentar a categoria" onChange={(event) => setCategoryDescription(event.target.value)} />
            </label>
            {draft.categoryLimitError ? <p className="tv-pfield-error" role="alert">{draft.categoryLimitError}</p> : null}
            <div className="tv-bulk-category-form-actions">
              {categories.length > 0 || draft.newCategories.length > 0 ? <button type="button" className="tv-pbtn is-ghost" onClick={cancelCategory}>Cancelar</button> : null}
              <button type="submit" className="tv-pbtn is-primary" disabled={draft.busy || !draft.canAddCategory}><LuPlus aria-hidden="true" />Criar categoria</button>
            </div>
          </form>
        )}
        {draft.newCategories.length > 0 ? <span className="tv-bulk-inline-note">Categorias novas serão salvas junto com o lote.</span> : null}
      </div>

      <div className="tv-bulk-groups">
        {categoriesForSelect.length === 0 ? (
          <div className="tv-bulk-empty">
            <span className="tv-bulk-empty-icon"><LuFolderPlus aria-hidden="true" /></span>
            <h3>Comece criando uma categoria</h3>
            <p>Depois você adiciona os pratos e completa mídia, preço e detalhes no mesmo espaço.</p>
          </div>
        ) : categoriesForSelect.map((category) => {
          const isNew = draft.newCategories.some((entry) => entry.id === category.id)
          const rows = draft.rows.filter((row) => row.values.categoryId === category.id)
          return (
            <BulkCategoryGroup
              key={category.id}
              category={category}
              items={rows}
              newCategory={isNew}
              canAddItem={draft.canAddItem}
              disabled={draft.busy}
              errors={draft.errors}
              revealErrorTick={draft.errorTick}
              mediaNotices={draft.mediaNotices}
              inspectingItems={draft.inspectingItems}
              categories={categories}
              newCategories={draft.newCategories}
              onAddItem={() => draft.addItem(category.id)}
              onRemoveCategory={() => { draft.removeCategory(category.id) }}
              onToggleItem={draft.toggleExpanded}
              onChangeItem={(rowId, field, value) => draft.updateField(rowId, field, value)}
              onSetPricing={draft.setPricing}
              onAddVariant={draft.addVariant}
              onUpdateVariant={draft.updateVariant}
              onRemoveVariant={draft.removeVariant}
              onMoveVariant={draft.moveVariant}
              onAddFiles={draft.addFiles}
              onRemoveMedia={draft.removeMedia}
              onMoveMedia={draft.moveMedia}
              onMakeCover={draft.makeCover}
              onRemoveItem={draft.removeItem}
            />
          )
        })}
      </div>

      <footer className="tv-bulk-footer" aria-live="polite">
        <div className="tv-bulk-footer-status">
          {draft.phase === 'uploading' && draft.uploadProgress ? <p role="status">Enviando mídias · {draft.uploadProgress.done} de {draft.uploadProgress.total}</p>
            : draft.phase === 'saving' ? <p role="status">Criando categorias e itens…</p>
              : draft.isPreparing ? <p role="status">Preparando mídias em segundo plano…</p>
                  : hasUncommittedCategory ? <p>Crie ou cancele a categoria nova antes de salvar este lote.</p>
                : draft.rows.length === 0 && draft.newCategories.length > 0
                  ? <p>{draft.newCategories.length} categorias prontas para criar · nada será publicado automaticamente</p>
                  : <p>{readyItemCount} prontos · {invalidItemCount} para revisar · {waitingMediaCount} aguardando mídias · nada será publicado automaticamente</p>}
          {draft.saveError ? <p className="tv-pfield-error" role="alert">{draft.saveError}</p> : null}
          {draft.uploadWarnings.map((warning) => <p className="tv-pfield-warning" role="status" key={warning}>{warning}</p>)}
        </div>
        <div className="tv-bulk-footer-actions">
          <button type="button" className="tv-pbtn is-ghost" disabled={draft.busy} onClick={back}>Voltar</button>
          <button type="button" className="tv-pbtn is-primary tv-bulk-save" disabled={draft.busy || draft.isPreparing || hasUncommittedCategory || (!draft.rows.length && !draft.newCategories.length)} aria-busy={draft.busy || undefined} onClick={() => void draft.save()}>
            {draft.phase === 'uploading' ? 'Enviando…' : draft.phase === 'saving' ? 'Criando…' : draft.rows.length === 0 ? 'Criar categorias' : `Criar ${draft.rows.length} ${draft.rows.length === 1 ? 'item' : 'itens'}`}
          </button>
        </div>
      </footer>

      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuList />}
        title="Descartar esta criação?"
        description="Os itens e as categorias que você montou neste espaço serão descartados. Nada foi publicado."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={onBack}
      />
    </section>
  )
}
