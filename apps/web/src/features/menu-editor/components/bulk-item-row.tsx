'use client'

import {
  LuAlignLeft,
  LuBadgeDollarSign,
  LuChevronDown,
  LuCircleAlert,
  LuCircleCheck,
  LuEye,
  LuImage,
  LuImages,
  LuShoppingBag,
  LuSlidersHorizontal,
  LuTags,
  LuTrash2,
} from 'react-icons/lu'
import { useState } from 'react'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO } from '@/domain/menu'
import { MAX_MEDIA_PER_ITEM } from '@/domain/media'
import type { ItemDraft } from '../lib/item-draft'
import { formatCents } from '@/lib/money'
import { useIsMobile } from '@/hooks/use-mobile'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { DietaryTagsInput } from './dietary-tags-input'
import { ItemMediaField } from './item-media-field'
import { PriceModeSwitch } from './price-mode-switch'
import { VariantList } from './variant-list'
import type { BulkDraftErrors, BulkItemDraft, NewMenuCategoryDraft } from '../lib/bulk-menu-draft'

function previewOf(row: BulkItemDraft) {
  const first = row.values.media[0]
  if (!first) return null
  if (first.source.type === 'new') return first.source.previewUrl
  return null
}

export function BulkItemRow({
  row,
  index,
  errors,
  mediaNotices,
  inspecting,
  categories,
  newCategories,
  disabled,
  onToggle,
  onChange,
  onSetPricing,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onMoveVariant,
  onAddFiles,
  onRemoveMedia,
  onMoveMedia,
  onMakeCover,
  onRemove,
}: {
  row: BulkItemDraft
  index: number
  errors?: BulkDraftErrors
  mediaNotices: string[]
  inspecting: boolean
  categories: OwnerMenuCategoryDTO[]
  newCategories: NewMenuCategoryDraft[]
  disabled: boolean
  onToggle: () => void
  onChange: (field: keyof ItemDraft, value: unknown) => void
  onSetPricing: (mode: BulkItemDraft['values']['pricing']) => void
  onAddVariant: () => string
  onUpdateVariant: (key: string, change: Partial<import('../lib/item-draft').VariantDraft>) => void
  onRemoveVariant: (key: string) => void
  onMoveVariant: (activeKey: string, overKey: string) => void
  onAddFiles: (files: File[]) => void
  onRemoveMedia: (key: string) => void
  onMoveMedia: (activeKey: string, overKey: string) => void
  onMakeCover: (key: string) => void
  onRemove: () => void
}) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const mobile = useIsMobile()
  const values = row.values
  const categoryOptions = [
    ...categories.map((category) => ({ value: category.id, label: category.name })),
    ...newCategories.map((category) => ({ value: category.id, label: category.name })),
  ]
  const preview = previewOf(row)
  const summaryTags = values.dietaryTags.slice(0, 2)
  const hasSummaryMeta = !values.isVisible || !values.isAvailable || values.dietaryTags.length > 0
  const hasEnteredData = Boolean(
    inspecting || values.name.trim() || values.description.trim() || values.dietaryTags.length || values.media.length
    || values.basePriceCents !== null || values.variants.length || values.pricing !== 'single'
    || !values.isVisible || !values.isAvailable || values.categoryId !== row.initialCategoryId,
  )
  const variantPrices = values.variants.filter((variant) => variant.priceCents !== null).map((variant) => variant.priceCents as number)
  const lowestVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null
  const priceSummary = values.pricing === 'single'
    ? (values.basePriceCents === null ? 'Preço pendente' : formatCents(values.basePriceCents))
    : lowestVariantPrice === null
      ? `${values.variants.length} ${values.variants.length === 1 ? 'variação' : 'variações'} · preço pendente`
      : `${formatCents(lowestVariantPrice)} · ${values.variants.length} ${values.variants.length === 1 ? 'variação' : 'variações'}`

  return (
    <article className={`tv-bulk-row${errors ? ' is-invalid' : ''}${!values.isVisible ? ' is-hidden' : ''}`} data-bulk-item={row.id}>
      <div className="tv-bulk-row-summary">
        <span className="tv-bulk-index" aria-label={`Item ${index}`}>{String(index).padStart(2, '0')}</span>
        <div className="tv-bulk-identity">
          <label className="tv-pfield tv-bulk-name">
            <span className="tv-pfield-label">Nome</span>
            <input
              className="tv-pinput"
              value={values.name}
              maxLength={120}
              placeholder="Nome do prato"
              aria-invalid={errors?.name ? true : undefined}
              disabled={disabled}
              onChange={(event) => onChange('name', event.target.value)}
            />
            {errors?.name ? <span className="tv-pfield-error">{errors.name}</span> : null}
          </label>
          {hasSummaryMeta ? (
            <div className="tv-bulk-summary-meta">
              {!values.isVisible ? <span className="tv-bulk-status">Oculto</span> : null}
              {!values.isAvailable ? <span className="tv-bulk-status">Indisponível</span> : null}
              {summaryTags.map((tag) => <span key={tag} className="tv-item-tag">{tag}</span>)}
              {values.dietaryTags.length > 2 ? <span title={values.dietaryTags.slice(2).join(', ')}>+{values.dietaryTags.length - 2} tags</span> : null}
            </div>
          ) : null}
        </div>
        <div className="tv-bulk-category">
          <span className="tv-pfield-label">Categoria</span>
          <Combobox
            label={`Categoria do item ${index}`}
            options={categoryOptions}
            value={values.categoryId || null}
            disabled={disabled || categoryOptions.length === 0}
            placeholder="Categoria"
            searchPlaceholder="Buscar categoria"
            emptyText="Nenhuma categoria encontrada."
            onValueChange={(next) => onChange('categoryId', next)}
          />
          {errors?.category ? <span className="tv-pfield-error">{errors.category}</span> : null}
        </div>
        <div className="tv-bulk-price-summary">
          <span className="tv-pfield-label">Preço</span>
          {values.pricing === 'single' ? (
            <label className="tv-pprice" data-invalid={errors?.price ? '' : undefined}>
              <span aria-hidden="true">R$</span>
              <CurrencyInput valueCents={values.basePriceCents} onValueChange={(value) => onChange('basePriceCents', value)} aria-label={`Preço do item ${index}`} aria-invalid={errors?.price ? true : undefined} disabled={disabled} />
            </label>
          ) : <span className="tv-bulk-price-label">{priceSummary}</span>}
          {errors?.price ? <span className="tv-pfield-error">{errors.price}</span> : null}
        </div>
        <button type="button" className="tv-bulk-expand" aria-expanded={row.expanded} onClick={onToggle}>
          <span>{row.expanded ? 'Recolher' : 'Detalhes'}</span><LuChevronDown aria-hidden="true" />
        </button>
        <button type="button" className="tv-bulk-remove" aria-label={`Remover item ${values.name || index}`} disabled={disabled} onClick={() => hasEnteredData ? setRemoveOpen(true) : onRemove()}>
          <LuTrash2 aria-hidden="true" />
        </button>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tv-bulk-preview" src={preview} alt="" />
        ) : <span className="tv-bulk-preview is-empty"><LuImage aria-hidden="true" /></span>}
      </div>

      {row.expanded ? (
        <div className="tv-bulk-row-details">
          <div className="tv-bulk-detail-grid">
            <section className="tv-bulk-detail-card tv-bulk-media-section">
              <header className="tv-bulk-card-heading">
                <span className="tv-bulk-card-icon"><LuImages aria-hidden="true" /></span>
                <div className="tv-bulk-card-copy">
                  <span className="tv-bulk-card-overline">CONTEÚDO VISUAL</span>
                  <h3>Fotos e vídeos</h3>
                  <p>A primeira mídia é a capa. Você pode adicionar até {MAX_MEDIA_PER_ITEM} arquivos.</p>
                </div>
              </header>
              <ItemMediaField
                media={values.media}
                disabled={disabled}
                variant={mobile ? 'mobile' : 'panel'}
                notices={mediaNotices}
                inspecting={inspecting}
                blockWhileInspecting
                error={errors?.media}
                onAddFiles={onAddFiles}
                onRemove={onRemoveMedia}
                onMove={onMoveMedia}
                onMakeCover={onMakeCover}
              />
              {values.isVisible && values.media.length === 0 ? (
                <div className="tv-bulk-media-warning" role="status">
                  <LuCircleAlert aria-hidden="true" />
                  <span>Sem mídia: este item não ficará pronto para publicação.</span>
                </div>
              ) : null}
            </section>

            <section className="tv-bulk-detail-card tv-bulk-details-card">
              <header className="tv-bulk-card-heading">
                <span className="tv-bulk-card-icon"><LuSlidersHorizontal aria-hidden="true" /></span>
                <div className="tv-bulk-card-copy">
                  <span className="tv-bulk-card-overline">CONFIGURAÇÃO DO PRATO</span>
                  <h3>Detalhes do prato</h3>
                  <p>Organize informações, preços e disponibilidade.</p>
                </div>
              </header>

              <div className="tv-bulk-detail-block">
                <div className="tv-bulk-block-heading">
                  <span className="tv-bulk-block-icon"><LuTags aria-hidden="true" /></span>
                  <div><h4>Destaques e restrições</h4><p>Ajude seus clientes a reconhecerem as características deste prato.</p></div>
                </div>
                <DietaryTagsInput value={values.dietaryTags} disabled={disabled} onChange={(tags) => onChange('dietaryTags', tags)} />
                {errors?.dietaryTags ? <span className="tv-pfield-error">{errors.dietaryTags}</span> : null}
              </div>

              <div className="tv-bulk-detail-block">
                <div className="tv-bulk-block-heading">
                  <span className="tv-bulk-block-icon"><LuBadgeDollarSign aria-hidden="true" /></span>
                  <div><h4>Preço e variações</h4><p>Escolha como o valor deste prato será apresentado.</p></div>
                </div>
                <PriceModeSwitch value={values.pricing} disabled={disabled} appearance={mobile ? 'mobile' : 'panel'} onChange={onSetPricing} />
                {values.pricing === 'variants' ? (
                  <>
                    <div className="tv-bulk-variant-panel">
                      <VariantList
                        variants={values.variants}
                        rowErrors={errors?.variantRows}
                        disabled={disabled}
                        appearance={mobile ? 'mobile' : 'panel'}
                        onAdd={onAddVariant}
                        onChange={onUpdateVariant}
                        onRemove={onRemoveVariant}
                        onMove={onMoveVariant}
                      />
                    </div>
                    {errors?.variants ? <span className="tv-pfield-error">{errors.variants}</span> : null}
                  </>
                ) : (
                  <div className="tv-bulk-price-note">
                    <span className="tv-bulk-price-note-mark" aria-hidden="true" />
                    <span>O preço único pode ser ajustado diretamente no resumo desta linha.</span>
                  </div>
                )}
              </div>

              <label className="tv-bulk-detail-block tv-bulk-description-block">
                <span className="tv-bulk-block-heading">
                  <span className="tv-bulk-block-icon"><LuAlignLeft aria-hidden="true" /></span>
                  <span className="tv-bulk-description-title">Descrição</span>
                </span>
                <textarea className="tv-pinput" rows={3} maxLength={600} value={values.description} aria-invalid={errors?.description ? true : undefined} disabled={disabled} onChange={(event) => onChange('description', event.target.value)} />
                {errors?.description ? <span className="tv-pfield-error">{errors.description}</span> : <span className="tv-pfield-help">Uma descrição curta dá contexto ao prato. Até 600 caracteres.</span>}
              </label>

              <div className="tv-bulk-detail-block tv-bulk-availability-block">
                <div className="tv-bulk-block-heading">
                  <span className="tv-bulk-block-icon"><LuCircleCheck aria-hidden="true" /></span>
                  <div><h4>Status no cardápio</h4><p>Controle como o prato aparece para seus clientes.</p></div>
                </div>
                <div className="tv-bulk-state-grid">
                  <label className="tv-bulk-state-card">
                    <span className="tv-bulk-state-icon"><LuEye aria-hidden="true" /></span>
                    <span className="tv-bulk-state-copy"><strong>Visível</strong><small>Aparece no cardápio público</small></span>
                    <Switch checked={values.isVisible} disabled={disabled} onCheckedChange={(next) => onChange('isVisible', next)} />
                  </label>
                  <label className="tv-bulk-state-card">
                    <span className="tv-bulk-state-icon"><LuShoppingBag aria-hidden="true" /></span>
                    <span className="tv-bulk-state-copy"><strong>Disponível</strong><small>Marcado como disponível</small></span>
                    <Switch checked={values.isAvailable} disabled={disabled} onCheckedChange={(next) => onChange('isAvailable', next)} />
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <PanelConfirm
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        icon={<LuTrash2 />}
        title="Remover este item?"
        description="Os dados e as mídias selecionadas neste rascunho serão descartados."
        confirmLabel="Remover item"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={onRemove}
      />
    </article>
  )
}
