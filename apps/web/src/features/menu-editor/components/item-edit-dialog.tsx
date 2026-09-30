'use client'

import { useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { DietaryTagsInput } from './dietary-tags-input'
import { ItemPanel } from './item-panel'
import { MediaEditor } from './media-editor'
import { useItemEditSubmit } from './use-item-submit'
import { VariantsEditor } from './variants-editor'

// Editar item (README §7.5): painel lateral com mídia e variações em cima,
// dados do item embaixo. A mídia nova sobe depois de o item ser salvo.
export function ItemEditDialog({
  item,
  categories,
  open,
  onOpenChange,
}: {
  item: OwnerMenuItemDTO
  categories: OwnerMenuCategoryDTO[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [visible, setVisible] = useState(item.isVisible)
  const [available, setAvailable] = useState(item.isAvailable)
  const [dietaryTags, setDietaryTags] = useState(item.dietaryTags)
  const [priceCents, setPriceCents] = useState<number | null>(item.basePriceCents)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [discardOpen, setDiscardOpen] = useState(false)
  const { editorRef, pending, error, submit } = useItemEditSubmit({ item, onDone: () => onOpenChange(false) })

  // Reabrir depois de cancelar mostra o que está salvo, e não o rascunho
  // abandonado (ajuste de estado durante o render, como no Quadro).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPriceCents(item.basePriceCents)
      setCategoryId(item.categoryId)
    }
  }

  // Preço e categoria vêm do estado; nome e descrição, do formulário. O
  // hook confere o preço ("Informe o preço."), grava e sobe a mídia.
  function save(formData: FormData) {
    return submit({
      name: String(formData.get('name') ?? ''),
      categoryId,
      description: String(formData.get('description') ?? ''),
      basePriceCents: priceCents,
      dietaryTags,
      isVisible: visible,
      isAvailable: available,
    })
  }

  // Fechar com mídia ainda não enviada pede confirmação antes de descartar.
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    if ((editorRef.current?.getPendingCount() ?? 0) > 0) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <ItemPanel open={open} onOpenChange={handleOpenChange} title="Editar item" subtitle={item.name}>
      <form action={save} className="tv-ipanel-form">
        <div className="tv-ipanel-body">
          <section className="tv-ipanel-media">
            <div className="tv-ipanel-section-head">
              <h3>Fotos e vídeos</h3>
              <p>A primeira mídia abre o prato; selecione uma foto para ajustar o enquadramento.</p>
            </div>
            <MediaEditor ref={editorRef} itemId={item.id} media={item.media} />
            <div className="tv-ipanel-section-head is-spaced">
              <h3>Variações</h3>
              <p>Tamanhos ou opções com preços diferentes.</p>
            </div>
            <VariantsEditor itemId={item.id} variants={item.variants} />
          </section>
          <section className="tv-ipanel-data">
            <div className="tv-ipanel-section-head">
              <h3>Dados do item</h3>
              <p>Nome, preço, descrição e estado no cardápio.</p>
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Nome</span>
              <input name="name" className="tv-pinput" defaultValue={item.name} required />
            </label>
            <div className="tv-pfield">
              <span className="tv-pfield-label">Destaques e restrições</span>
              <DietaryTagsInput value={dietaryTags} onChange={setDietaryTags} />
            </div>
            <div className="tv-ipanel-split">
              <div className="tv-pfield">
                <span className="tv-pfield-label">Categoria</span>
                <Combobox
                  label="Categoria"
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  value={categoryId}
                  onValueChange={setCategoryId}
                />
              </div>
              <label className="tv-pfield">
                <span className="tv-pfield-label">Preço</span>
                <span className="tv-pprice">
                  <span aria-hidden="true">R$</span>
                  <CurrencyInput valueCents={priceCents} onValueChange={setPriceCents} required />
                </span>
              </label>
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Descrição</span>
              <textarea name="description" rows={3} className="tv-pinput" defaultValue={item.description ?? ''} />
              <span className="tv-pfield-help">Texto simples; não aceita os caracteres menor e maior.</span>
            </label>
            <div className="tv-ipanel-toggles">
              <label className="tv-ptoggle">Visível<Switch checked={visible} onCheckedChange={(next) => setVisible(next)} /></label>
              <label className="tv-ptoggle">Disponível<Switch checked={available} onCheckedChange={(next) => setAvailable(next)} /></label>
            </div>
          </section>
        </div>
        <footer className="tv-ipanel-foot">
          <p role="alert" className="tv-ipanel-error">{error}</p>
          <button type="button" className="tv-pbtn is-ghost" onClick={() => handleOpenChange(false)}>Fechar</button>
          <button type="submit" className="tv-pbtn is-primary" disabled={pending}>
            {pending ? <Spinner className="size-3.5" /> : null}Salvar item
          </button>
        </footer>
      </form>
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar mídia pendente?"
        description="Os arquivos ainda não enviados serão descartados ao fechar este item."
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </ItemPanel>
  )
}
