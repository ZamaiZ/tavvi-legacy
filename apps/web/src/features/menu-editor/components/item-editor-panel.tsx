'use client'

import { useEffect, useRef, useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { DietaryTagsInput } from './dietary-tags-input'
import { ItemMediaField } from './item-media-field'
import { ItemPanel, useItemPanelGuard } from './item-panel'
import { PriceModeSwitch } from './price-mode-switch'
import { useItemDraft, type SavePhase } from './use-item-draft'
import { VariantList } from './variant-list'

export function phaseLabel(phase: SavePhase, progress: { done: number; total: number } | null, creating: boolean): string | null {
  if (phase === 'preparing') return 'Preparando mídia…'
  if (phase === 'uploading' && progress) return `Enviando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
  if (phase === 'saving') return creating ? 'Criando…' : 'Salvando…'
  return null
}

// Criar e editar item no desktop (README §7.5): o mesmo painel lateral, com
// mídia em cima e dados embaixo. O corpo monta a cada abertura (o Base UI
// desmonta o popup fechado), então o rascunho sempre recomeça do salvo.
export function ItemEditorPanel({
  restaurantId,
  item,
  categoryId,
  categories,
  open,
  onOpenChange,
}: {
  restaurantId: string
  /** Nulo: criar. */
  item: OwnerMenuItemDTO | null
  categoryId: string
  /** Com a lista, aparece o seletor de categoria. */
  categories?: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ItemPanel
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Editar item' : 'Novo item'}
      subtitle={item ? item.name : 'As fotos e os vídeos sobem quando você criar o item.'}
    >
      <ItemEditorBody
        restaurantId={restaurantId}
        item={item}
        categoryId={categoryId}
        categories={categories}
        onClose={() => onOpenChange(false)}
      />
    </ItemPanel>
  )
}

function ItemEditorBody({
  restaurantId,
  item,
  categoryId,
  categories,
  onClose,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO | null
  categoryId: string
  categories?: OwnerMenuCategoryDTO[]
  onClose: () => void
}) {
  const creating = item === null
  const draft = useItemDraft({ restaurantId, item, categoryId, onSaved: onClose })
  const { values, errors, busy } = draft
  const [discardOpen, setDiscardOpen] = useState(false)
  const [variantFocus, setVariantFocus] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const savedVariantCount = item?.variants.length ?? 0
  const status = phaseLabel(draft.phase, draft.progress, creating)

  useItemPanelGuard(busy, () => {
    if (!draft.dirty) return true
    setDiscardOpen(true)
    return false
  })

  // Depois de um salvar recusado, leva a pessoa ao primeiro problema.
  useEffect(() => {
    if (draft.errorTick === 0) return
    formRef.current
      ?.querySelector('[aria-invalid="true"], .tv-media-tile.is-error, .tv-vrow.is-invalid')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [draft.errorTick])

  function close() {
    if (draft.dirty) setDiscardOpen(true)
    else onClose()
  }

  return (
    <form
      ref={formRef}
      className="tv-ipanel-form"
      noValidate
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault()
        draft.save()
      }}
    >
      <fieldset disabled={busy} className="tv-ipanel-fieldset">
        <div className="tv-ipanel-body">
          <section className="tv-ipanel-media">
            <div className="tv-ipanel-section-head">
              <h3>Fotos e vídeos</h3>
              <p>A primeira abre o prato. Arraste para mudar a ordem; selecione uma foto para ajustar o enquadramento.</p>
            </div>
            <ItemMediaField
              media={values.media}
              disabled={busy}
              notices={draft.mediaNotices}
              inspecting={draft.inspecting}
              error={errors.media}
              onAddFiles={draft.addFiles}
              onRemove={draft.removeMedia}
              onMove={draft.moveMedia}
              onMakeCover={draft.makeCover}
              onFocal={draft.setFocal}
            />
          </section>
          <section className="tv-ipanel-data">
            <div className="tv-ipanel-section-head">
              <h3>{creating ? 'Dados básicos' : 'Dados do item'}</h3>
              <p>{creating ? 'Nome, preço e descrição.' : 'Nome, preço, descrição e estado no cardápio.'}</p>
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Nome</span>
              <input
                className="tv-pinput"
                value={values.name}
                maxLength={120}
                placeholder="Pão de alho"
                autoFocus={creating}
                aria-invalid={errors.name ? true : undefined}
                onChange={(event) => draft.update('name', event.target.value)}
              />
              {errors.name ? <span className="tv-pfield-error">{errors.name}</span> : null}
            </label>
            <div className="tv-pfield">
              <span className="tv-pfield-label">Destaques e restrições</span>
              <DietaryTagsInput value={values.dietaryTags} disabled={busy} onChange={(tags) => draft.update('dietaryTags', tags)} />
            </div>
            {categories ? (
              <div className="tv-pfield">
                <span className="tv-pfield-label">Categoria</span>
                <Combobox
                  label="Categoria"
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  value={values.categoryId}
                  disabled={busy}
                  onValueChange={(next) => draft.update('categoryId', next)}
                />
              </div>
            ) : null}
            <div className="tv-pfield">
              <span className="tv-pfield-label">Preço</span>
              <PriceModeSwitch
                value={values.pricing}
                disabled={busy}
                onChange={(mode) => setVariantFocus(draft.setPricing(mode))}
              />
              {values.pricing === 'single' ? (
                <>
                  <span className="tv-pprice tv-pfield-price" data-invalid={errors.price ? '' : undefined}>
                    <span aria-hidden="true">R$</span>
                    <CurrencyInput
                      valueCents={values.basePriceCents}
                      onValueChange={(cents) => draft.update('basePriceCents', cents)}
                      aria-label="Preço"
                      aria-invalid={errors.price ? true : undefined}
                      disabled={busy}
                    />
                  </span>
                  {errors.price ? <span className="tv-pfield-error">{errors.price}</span> : null}
                  {savedVariantCount > 0 ? (
                    <span className="tv-pfield-warning" role="status">
                      Ao salvar, {savedVariantCount === 1 ? 'a variação será removida' : `as ${savedVariantCount} variações serão removidas`}.
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <VariantList
                    variants={values.variants}
                    rowErrors={errors.variantRows}
                    disabled={busy}
                    focusKey={variantFocus}
                    onAdd={draft.addVariant}
                    onChange={draft.updateVariant}
                    onRemove={draft.removeVariant}
                    onMove={draft.moveVariant}
                  />
                  {errors.variants ? <span className="tv-pfield-error">{errors.variants}</span> : null}
                </>
              )}
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Descrição</span>
              <textarea
                className="tv-pinput"
                rows={3}
                maxLength={600}
                value={values.description}
                aria-invalid={errors.description ? true : undefined}
                onChange={(event) => draft.update('description', event.target.value)}
              />
              <span className="tv-pfield-help">Até 600 caracteres; texto simples, sem os caracteres menor e maior.</span>
              {errors.description ? <span className="tv-pfield-error">{errors.description}</span> : null}
            </label>
            {creating ? null : (
              <div className="tv-ipanel-toggles">
                <label className="tv-ptoggle">Visível<Switch checked={values.isVisible} disabled={busy} onCheckedChange={(next) => draft.update('isVisible', next)} /></label>
                <label className="tv-ptoggle">Disponível<Switch checked={values.isAvailable} disabled={busy} onCheckedChange={(next) => draft.update('isAvailable', next)} /></label>
              </div>
            )}
          </section>
        </div>
      </fieldset>
      <footer className="tv-ipanel-foot">
        {status ? (
          <p role="status" className="tv-ipanel-status">{status}</p>
        ) : (
          <p role="alert" className="tv-ipanel-error">{draft.saveError}</p>
        )}
        <button type="button" className="tv-pbtn is-ghost" disabled={busy} onClick={close}>
          {creating ? 'Cancelar' : 'Fechar'}
        </button>
        <button
          type="submit"
          className="tv-pbtn is-primary"
          disabled={busy || (!creating && !draft.dirty)}
          aria-busy={busy || undefined}
        >
          {busy ? <Spinner className="size-3.5" aria-hidden="true" /> : null}
          {busy ? (creating ? 'Criando…' : 'Salvando…') : creating ? 'Criar item' : 'Salvar item'}
        </button>
      </footer>
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar alterações?"
        description={creating ? 'O item não será criado, e as fotos e os vídeos escolhidos serão descartados.' : 'As alterações deste item serão perdidas.'}
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={onClose}
      />
    </form>
  )
}
