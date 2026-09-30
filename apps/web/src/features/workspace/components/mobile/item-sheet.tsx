'use client'

import { useId, useState, type FormEvent, type RefObject } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetGuard } from '@/components/shell/mobile-sheet'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { MediaEditor, type MediaEditorHandle } from '@/features/menu-editor/components/media-editor'
import { useItemCreateSubmit, useItemEditSubmit } from '@/features/menu-editor/components/use-item-submit'
import { PanelConfirm } from '../panel-confirm'
import { CategoryRow, NavRow, PriceRow, TagsScreen, VariantsScreen, variantsLabel } from './item-sheet-fields'

const DESCRIPTION_NOTE = 'Texto simples; não aceita os caracteres menor e maior.'

// Fechar com mídia ainda não enviada pede confirmação antes de descartar.
function useMediaGuard(editorRef: RefObject<MediaEditorHandle | null>, onBlocked: () => void) {
  useSheetGuard(() => {
    if ((editorRef.current?.getPendingCount() ?? 0) === 0) return true
    onBlocked()
    return false
  })
}

// Editar item no celular (print "editar item", bloco bEdit): mídia em 3
// colunas, Nome · Preço · Categoria, Descrição, Visível · Disponível,
// Variações › e Destaques ›, e Excluir.
export function ItemEditSheet({
  item,
  categories,
  open,
  onOpenChange,
  onDelete,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Roda depois da confirmação feita dentro do sheet. */
  onDelete: () => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <ItemEditBody item={item} categories={categories} onDelete={onDelete} />
    </MobileSheet>
  )
}

function ItemEditBody({
  item,
  categories,
  onDelete,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  onDelete: () => void
}) {
  const { forceClose } = useMobileSheet()
  const formId = useId()
  const [screen, setScreen] = useState<'main' | 'variants' | 'tags'>('main')
  const [name, setName] = useState(item.name)
  const [priceCents, setPriceCents] = useState<number | null>(item.basePriceCents)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [description, setDescription] = useState(item.description ?? '')
  const [visible, setVisible] = useState(item.isVisible)
  const [available, setAvailable] = useState(item.isAvailable)
  const [tags, setTags] = useState(item.dietaryTags)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { editorRef, pending, error, submit } = useItemEditSubmit({ item, onDone: forceClose })
  useMediaGuard(editorRef, () => setDiscardOpen(true))

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit({ name, categoryId, description, basePriceCents: priceCents, dietaryTags: tags, isVisible: visible, isAvailable: available })
  }

  return (
    <>
      <MobileSheetNav
        title={screen === 'variants' ? 'Variações' : screen === 'tags' ? 'Destaques' : 'Editar item'}
        cancelLabel="Fechar"
        back={screen === 'main' ? undefined : { label: 'Editar item', onBack: () => setScreen('main') }}
        action={screen === 'main' ? { label: 'Salvar', form: formId, pending, disabled: name.trim().length < 2 } : undefined}
      />
      <form id={formId} className="tv-msheet-screen" hidden={screen !== 'main'} onSubmit={onSubmit} noValidate>
        {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
        <MediaEditor ref={editorRef} itemId={item.id} media={item.media} variant="mobile" />
        <div className="tv-group">
          <label className="tv-frow">
            <span>Nome</span>
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="off" placeholder="Nome do prato" />
          </label>
          <PriceRow valueCents={priceCents} onValueChange={setPriceCents} />
          <CategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <div className="tv-group">
          <textarea className="tv-farea" rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição" aria-label="Descrição" />
        </div>
        <p className="tv-sheet-m-note">{DESCRIPTION_NOTE}</p>
        <div className="tv-group">
          <label className="tv-frow is-toggle">
            <span>Visível</span>
            <Switch size="lg" checked={visible} onCheckedChange={(next) => setVisible(next)} />
          </label>
          <label className="tv-frow is-toggle">
            <span>Disponível</span>
            <Switch size="lg" checked={available} onCheckedChange={(next) => setAvailable(next)} />
          </label>
        </div>
        <div className="tv-group">
          <NavRow label="Variações" value={variantsLabel(item.variants.length)} onClick={() => setScreen('variants')} />
          <NavRow label="Destaques e restrições" value={tags.length > 0 ? String(tags.length) : null} onClick={() => setScreen('tags')} />
        </div>
        <div className="tv-group">
          <button type="button" className="tv-group-danger" onClick={() => setDeleteOpen(true)}>
            <LuTrash2 aria-hidden="true" />Excluir item
          </button>
        </div>
      </form>
      {screen === 'variants' ? (
        <div className="tv-msheet-screen is-pushed"><VariantsScreen itemId={item.id} variants={item.variants} /></div>
      ) : null}
      {screen === 'tags' ? (
        <div className="tv-msheet-screen is-pushed"><TagsScreen value={tags} onChange={setTags} /></div>
      ) : null}
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar mídia pendente?"
        description="Os arquivos ainda não enviados serão descartados ao fechar este item."
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={forceClose}
      />
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
    </>
  )
}

// Novo item no celular: o mesmo sheet, sem Visível/Disponível (nasce
// visível e disponível), sem Variações (vêm na edição) e sem Excluir.
export function ItemCreateSheet({
  restaurantId,
  categoryId,
  categories,
  open,
  onOpenChange,
}: {
  restaurantId: string
  categoryId: string
  categories: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <ItemCreateBody restaurantId={restaurantId} initialCategoryId={categoryId} categories={categories} />
    </MobileSheet>
  )
}

function ItemCreateBody({
  restaurantId,
  initialCategoryId,
  categories,
}: {
  restaurantId: string
  initialCategoryId: string
  categories: OwnerMenuCategoryDTO[]
}) {
  const { forceClose } = useMobileSheet()
  const formId = useId()
  const [screen, setScreen] = useState<'main' | 'tags'>('main')
  const [name, setName] = useState('')
  const [priceCents, setPriceCents] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  const { editorRef, pending, error, submit } = useItemCreateSubmit({ restaurantId, onDone: forceClose })
  useMediaGuard(editorRef, () => setDiscardOpen(true))

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit({ name, categoryId, description, basePriceCents: priceCents, dietaryTags: tags })
  }

  return (
    <>
      <MobileSheetNav
        title={screen === 'tags' ? 'Destaques' : 'Novo item'}
        back={screen === 'tags' ? { label: 'Novo item', onBack: () => setScreen('main') } : undefined}
        action={screen === 'main' ? { label: 'Criar', form: formId, pending, disabled: name.trim().length < 2 } : undefined}
      />
      <form id={formId} className="tv-msheet-screen" hidden={screen !== 'main'} onSubmit={onSubmit} noValidate>
        {error ? <p role="alert" className="tv-sheet-m-error">{error}</p> : null}
        <MediaEditor ref={editorRef} itemId={null} media={[]} variant="mobile" />
        <div className="tv-group">
          <label className="tv-frow">
            <span>Nome</span>
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoComplete="off" placeholder="Nome do prato" />
          </label>
          <PriceRow valueCents={priceCents} onValueChange={setPriceCents} />
          <CategoryRow categories={categories} value={categoryId} onChange={setCategoryId} />
        </div>
        <div className="tv-group">
          <textarea className="tv-farea" rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição" aria-label="Descrição" />
        </div>
        <p className="tv-sheet-m-note">{DESCRIPTION_NOTE}</p>
        <div className="tv-group">
          <NavRow label="Destaques e restrições" value={tags.length > 0 ? String(tags.length) : null} onClick={() => setScreen('tags')} />
        </div>
      </form>
      {screen === 'tags' ? (
        <div className="tv-msheet-screen is-pushed"><TagsScreen value={tags} onChange={setTags} /></div>
      ) : null}
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar mídia pendente?"
        description="Os arquivos selecionados serão descartados e o item não será criado."
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={forceClose}
      />
    </>
  )
}
