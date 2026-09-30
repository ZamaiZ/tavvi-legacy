'use client'

import { useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Spinner } from '@/components/ui/spinner'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { DietaryTagsInput } from './dietary-tags-input'
import { ItemPanel } from './item-panel'
import { MediaEditor } from './media-editor'
import { useItemCreateSubmit } from './use-item-submit'

// Novo item: mesmo painel lateral do editar. As fotos e os vídeos ficam em
// espera e sobem depois que o item nasce; variações vêm no editar.
export function ItemCreateDialog({
  restaurantId,
  categoryId,
  open,
  onOpenChange,
}: {
  restaurantId: string
  categoryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [dietaryTags, setDietaryTags] = useState<string[]>([])
  const [priceCents, setPriceCents] = useState<number | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const { editorRef, pending, error, submit } = useItemCreateSubmit({ restaurantId, onDone: () => onOpenChange(false) })

  // Reabrir depois de cancelar começa com o preço vazio, e não com o
  // rascunho abandonado.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setPriceCents(null)
  }

  // O preço vem do estado; o resto, do formulário. O hook confere o preço
  // ("Informe o preço."), cria o item e sobe a mídia em espera.
  function save(formData: FormData) {
    return submit({
      name: String(formData.get('name') ?? ''),
      categoryId,
      description: String(formData.get('description') ?? ''),
      basePriceCents: priceCents,
      dietaryTags,
    })
  }

  // Fechar com arquivos escolhidos pede confirmação antes de descartar.
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
    <ItemPanel open={open} onOpenChange={handleOpenChange} title="Novo item" subtitle="Escolha as fotos e os vídeos agora; o envio começa ao criar o item.">
      <form action={save} className="tv-ipanel-form">
        <div className="tv-ipanel-body">
          <section className="tv-ipanel-media">
            <div className="tv-ipanel-section-head">
              <h3>Fotos e vídeos</h3>
              <p>Arraste, cole ou selecione arquivos e defina a ordem.</p>
            </div>
            <MediaEditor ref={editorRef} itemId={null} media={[]} />
          </section>
          <section className="tv-ipanel-data">
            <div className="tv-ipanel-section-head">
              <h3>Dados básicos</h3>
              <p>A descrição e as variações podem ser completadas depois.</p>
            </div>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Nome</span>
              <input name="name" className="tv-pinput" placeholder="Pão de alho" autoFocus required />
            </label>
            <label className="tv-pfield">
              <span className="tv-pfield-label">Descrição</span>
              <textarea name="description" rows={3} maxLength={600} className="tv-pinput" />
              <span className="tv-pfield-help">Até 600 caracteres.</span>
            </label>
            <div className="tv-pfield">
              <span className="tv-pfield-label">Destaques e restrições</span>
              <DietaryTagsInput value={dietaryTags} onChange={setDietaryTags} />
            </div>
            <label className="tv-pfield tv-pfield-price">
              <span className="tv-pfield-label">Preço</span>
              <span className="tv-pprice">
                <span aria-hidden="true">R$</span>
                <CurrencyInput valueCents={priceCents} onValueChange={setPriceCents} required />
              </span>
            </label>
          </section>
        </div>
        <footer className="tv-ipanel-foot">
          <p role="alert" className="tv-ipanel-error">{error}</p>
          <button type="button" className="tv-pbtn is-ghost" onClick={() => handleOpenChange(false)}>Cancelar</button>
          <button type="submit" className="tv-pbtn is-primary" disabled={pending}>
            {pending ? <Spinner className="size-3.5" /> : null}Criar item
          </button>
        </footer>
      </form>
      <PanelConfirm
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={<LuTrash2 />}
        title="Descartar mídia pendente?"
        description="Os arquivos selecionados serão descartados e o item não será criado."
        confirmLabel="Descartar e fechar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </ItemPanel>
  )
}
