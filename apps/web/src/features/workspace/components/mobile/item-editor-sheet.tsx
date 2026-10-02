'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetBusy, useSheetGuard } from '@/components/shell/mobile-sheet'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { phaseLabel } from '@/features/menu-editor/components/item-editor-panel'
import { ItemMediaField } from '@/features/menu-editor/components/item-media-field'
import { PriceModeSwitch } from '@/features/menu-editor/components/price-mode-switch'
import { useItemDraft } from '@/features/menu-editor/components/use-item-draft'
import { VariantList } from '@/features/menu-editor/components/variant-list'
import { variantCountLabel } from '@/features/menu-editor/lib/item-display'
import { PanelConfirm } from '../panel-confirm'
import { CategoryRow, NavRow, PriceRow, TagsScreen } from './item-sheet-fields'

const DESCRIPTION_NOTE = 'Texto simples; não aceita os caracteres menor e maior.'

// Criar e editar item no celular (print "editar item", bloco bEdit). Mesmo
// rascunho do desktop: nada grava antes de "Criar"/"Salvar".
export function ItemEditorSheet({
  restaurantId,
  item,
  categoryId,
  categories,
  open,
  onOpenChange,
  onDelete,
}: {
  restaurantId: string
  /** Nulo: criar. */
  item: OwnerMenuItemDTO | null
  categoryId: string
  categories: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Só na edição; roda depois da confirmação feita dentro do sheet. */
  onDelete?: () => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <ItemSheetBody restaurantId={restaurantId} item={item} categoryId={categoryId} categories={categories} onDelete={onDelete} />
    </MobileSheet>
  )
}

function ItemSheetBody({
  restaurantId,
  item,
  categoryId,
  categories,
  onDelete,
}: {
  restaurantId: string
  item: OwnerMenuItemDTO | null
  categoryId: string
  categories: OwnerMenuCategoryDTO[]
  onDelete?: () => void
}) {
  const { forceClose } = useMobileSheet()
  const creating = item === null
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const draft = useItemDraft({ restaurantId, item, categoryId, onSaved: forceClose })
  const { values, errors, busy } = draft
  const [screen, setScreen] = useState<'main' | 'variants' | 'tags'>('main')
  const [variantFocus, setVariantFocus] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const savedVariantCount = item?.variants.length ?? 0
  const variantProblem = errors.variants ?? (errors.variantRows ? 'Revise as variações.' : undefined)

  useSheetBusy(busy)
  useSheetGuard(() => {
    if (!draft.dirty) return true
    setDiscardOpen(true)
    return false
  })

  // Salvar recusado: volta à tela principal e mostra o primeiro problema.
  useEffect(() => {
    if (draft.errorTick === 0) return
    setScreen('main')
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector('[aria-invalid="true"], .tv-media-tile.is-error, [data-variant-error]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [draft.errorTick])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    draft.save()
  }

  const mainTitle = creating ? 'Novo item' : 'Editar item'
  const title = screen === 'variants' ? 'Variações' : screen === 'tags' ? 'Destaques' : mainTitle
  const status = phaseLabel(draft.phase, draft.progress, creating)

  return (
    <>
      <MobileSheetNav
        title={title}
        cancelLabel={creating ? 'Cancelar' : 'Fechar'}
        back={screen === 'main' ? undefined : { label: mainTitle, onBack: () => setScreen('main') }}
        action={
          screen === 'main'
            ? {
                label: creating ? 'Criar' : 'Salvar',
                pendingLabel: status ?? (creating ? 'Criando…' : 'Salvando…'),
                form: formId,
                pending: busy,
                disabled: values.name.trim().length < 2 || (!creating && !draft.dirty),
              }
            : undefined
        }
      />
      <form ref={formRef} id={formId} className="tv-msheet-screen" hidden={screen !== 'main'} onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
        {draft.saveError ? <p role="alert" className="tv-sheet-m-error">{draft.saveError}</p> : null}
        <fieldset disabled={busy} className="tv-msheet-fieldset">
          <ItemMediaField
            variant="mobile"
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
          <div className="tv-group">
            <label className="tv-frow">
              <span>Nome</span>
              <input
                value={values.name}
                maxLength={120}
                autoComplete="off"
                placeholder="Nome do prato"
                aria-invalid={errors.name ? true : undefined}
                onChange={(event) => draft.update('name', event.target.value)}
              />
            </label>
            <div className="tv-frow">
              <span>Tipo de preço</span>
              <PriceModeSwitch
                appearance="mobile"
                value={values.pricing}
                disabled={busy}
                onChange={(mode) => setVariantFocus(draft.setPricing(mode))}
              />
            </div>
            {values.pricing === 'single' ? (
              <PriceRow valueCents={values.basePriceCents} onValueChange={(cents) => draft.update('basePriceCents', cents)} disabled={busy} />
            ) : (
              <NavRow
                label="Variações"
                value={values.variants.length > 0 ? variantCountLabel(values.variants.length) : 'Adicionar'}
                disabled={busy}
                onClick={() => setScreen('variants')}
              />
            )}
            <CategoryRow categories={categories} value={values.categoryId} onChange={(next) => draft.update('categoryId', next)} disabled={busy} />
          </div>
          {errors.name ? <p role="alert" className="tv-sheet-m-error">{errors.name}</p> : null}
          {errors.price ? <p role="alert" className="tv-sheet-m-error">{errors.price}</p> : null}
          {values.pricing === 'variants' && variantProblem ? (
            <p role="alert" className="tv-sheet-m-error" data-variant-error="">{variantProblem}</p>
          ) : null}
          {values.pricing === 'single' && savedVariantCount > 0 ? (
            <p className="tv-sheet-m-note">
              Ao salvar, {savedVariantCount === 1 ? 'a variação será removida' : `as ${savedVariantCount} variações serão removidas`}.
            </p>
          ) : null}
          <div className="tv-group">
            <textarea
              className="tv-farea"
              rows={3}
              maxLength={600}
              value={values.description}
              placeholder="Descrição"
              aria-label="Descrição"
              aria-invalid={errors.description ? true : undefined}
              onChange={(event) => draft.update('description', event.target.value)}
            />
          </div>
          <p className="tv-sheet-m-note">{errors.description ?? DESCRIPTION_NOTE}</p>
          {creating ? null : (
            <div className="tv-group">
              <label className="tv-frow is-toggle">
                <span>Visível</span>
                <Switch size="lg" checked={values.isVisible} disabled={busy} onCheckedChange={(next) => draft.update('isVisible', next)} />
              </label>
              <label className="tv-frow is-toggle">
                <span>Disponível</span>
                <Switch size="lg" checked={values.isAvailable} disabled={busy} onCheckedChange={(next) => draft.update('isAvailable', next)} />
              </label>
            </div>
          )}
          <div className="tv-group">
            <NavRow
              label="Destaques e restrições"
              value={values.dietaryTags.length > 0 ? String(values.dietaryTags.length) : null}
              disabled={busy}
              onClick={() => setScreen('tags')}
            />
          </div>
          {creating || !onDelete ? null : (
            <div className="tv-group">
              <button type="button" className="tv-group-danger" onClick={() => setDeleteOpen(true)}>
                <LuTrash2 aria-hidden="true" />Excluir item
              </button>
            </div>
          )}
        </fieldset>
      </form>
      {screen === 'variants' ? (
        <div className="tv-msheet-screen is-pushed">
          <VariantList
            appearance="mobile"
            variants={values.variants}
            rowErrors={errors.variantRows}
            disabled={busy}
            focusKey={variantFocus}
            onAdd={draft.addVariant}
            onChange={draft.updateVariant}
            onRemove={draft.removeVariant}
            onMove={draft.moveVariant}
          />
          <p className="tv-sheet-m-note">Tamanhos ou opções com preços diferentes. Tudo vale quando você salvar o item.</p>
        </div>
      ) : null}
      {screen === 'tags' ? (
        <div className="tv-msheet-screen is-pushed">
          <TagsScreen value={values.dietaryTags} onChange={(tags) => draft.update('dietaryTags', tags)} disabled={busy} />
        </div>
      ) : null}
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar alterações?"
        description={creating ? 'O item não será criado, e as fotos e os vídeos escolhidos serão descartados.' : 'As alterações deste item serão perdidas.'}
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={forceClose}
      />
      {item && onDelete ? (
        <PanelConfirm
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          icon={<LuTrash2 />}
          title={`Excluir ${item.name}?`}
          description="As variações e as fotos deste item saem junto. Isto não pode ser desfeito."
          confirmLabel="Excluir"
          destructive
          onConfirm={() => {
            forceClose()
            onDelete()
          }}
        />
      ) : null}
    </>
  )
}
