'use client'

import { useOptimistic, useTransition } from 'react'
import { LuEyeOff, LuUtensils } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import type { OwnerMenuCategoryDTO, OwnerMenuItemDTO } from '@/domain/menu'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import { setItemAvailabilityAction } from '@/server/actions/menu'
import { priceLabel } from '../../lib/item-display'
import { StandaloneItemContextMenu } from '../item-context-menu'

// Serviço (README §7.5, item 9): toque alterna disponível/esgotado.
export function ServiceMode({
  restaurantId,
  categories,
  canEdit,
  showIntro = true,
  onReviewMenu,
  onManageHiddenItems,
}: {
  restaurantId: string
  categories: OwnerMenuCategoryDTO[]
  canEdit: boolean
  /** A rota Serviço tem o próprio cabeçalho e dispensa a frase. */
  showIntro?: boolean
  onReviewMenu: () => void
  onManageHiddenItems: () => void
}) {
  const items = categories.flatMap((category) => category.items)
  const visibleItems = items.filter((item) => item.isVisible)

  return (
    <>
      {showIntro ? <p className="tv-mode-intro">Toque para alternar entre disponível e esgotado durante o atendimento.</p> : null}
      {items.length === 0 ? (
        <PanelEmptyState
          density="section"
          icon={<LuUtensils />}
          title="O cardápio ainda não tem itens"
          description="Adicione os primeiros pratos para acompanhar a disponibilidade durante o atendimento."
          action={<button type="button" className="tv-pbtn is-sm" onClick={onReviewMenu}>Abrir cardápio</button>}
        />
      ) : visibleItems.length === 0 ? (
        <PanelEmptyState
          density="section"
          icon={<LuEyeOff />}
          title="Nenhum item visível"
          description="Os itens ocultos não aparecem no atendimento. Revise a visibilidade no cardápio."
          action={<button type="button" className="tv-pbtn is-sm" onClick={onManageHiddenItems}>Ver itens ocultos</button>}
        />
      ) : (
        <section className="tv-service" aria-label="Disponibilidade dos itens">
          {visibleItems.map((item) => <ServiceTile key={item.id} restaurantId={restaurantId} item={item} categories={categories} canEdit={canEdit} />)}
        </section>
      )}
    </>
  )
}

function ServiceTile({ restaurantId, item, categories, canEdit }: { restaurantId: string; item: OwnerMenuItemDTO; categories: OwnerMenuCategoryDTO[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition()
  const [available, setAvailable] = useOptimistic(item.isAvailable)

  // Sem desabilitar o botão durante o envio: desabilitar tira o foco de quem
  // usa teclado. A trava é o `pending`.
  function toggle() {
    if (!canEdit || pending) return
    const next = !available
    startTransition(async () => {
      setAvailable(next)
      const result = await setItemAvailabilityAction({ itemId: item.id, isAvailable: next })
      toast.add(result.ok ? { title: next ? 'Item disponível' : 'Item esgotado', type: 'success' } : { title: result.error, type: 'error' })
    })
  }

  // O toque alterna a disponibilidade; no desktop, o botão direito abre as
  // ações do item (spec de componentes §4.3).
  return (
    <StandaloneItemContextMenu
      restaurantId={restaurantId}
      item={item}
      categories={categories}
      disabled={!canEdit}
      render={<button type="button" className={`tv-service-tile${available ? '' : ' is-soldout'}`} aria-pressed={available} aria-busy={pending} aria-disabled={!canEdit} onClick={toggle} />}
    >
      <span className="tv-service-state"><span aria-hidden="true" />{available ? 'Disponível' : 'Esgotado'}</span>
      <strong>{item.name}</strong>
      <small>{priceLabel(item)}</small>
      {pending ? <span className="sr-only" role="status">Salvando disponibilidade…</span> : null}
    </StandaloneItemContextMenu>
  )
}
