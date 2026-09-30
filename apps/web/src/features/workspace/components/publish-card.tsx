'use client'

import Link from 'next/link'
import { useId, useState, useTransition } from 'react'
import { LuChevronDown, LuChevronUp, LuCircleAlert, LuCircleCheck, LuCopy, LuExternalLink, LuEyeOff, LuGlobe, LuImage, LuSend } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import type { RestaurantStatus } from '@/domain/restaurant'
import { setPublishedAction } from '@/server/actions/restaurants'
import { PanelConfirm } from './panel-confirm'

const STATUS_LABEL: Record<RestaurantStatus, string> = { active: 'No ar', draft: 'Rascunho', suspended: 'Suspenso' }
const STATUS_DESCRIPTION: Record<RestaurantStatus, string> = {
  active: 'Quem encostar o celular na plaquinha vê o cardápio.',
  draft: 'Só você vê. Publique quando terminar de montar.',
  suspended: 'Fale com o administrador da plataforma.',
}

// Cartão dourado de publicação (README §7.5, item 2). Um por tela.
export function PublishCard({
  restaurantId,
  status: initialStatus,
  publicUrl,
  canEdit,
  missingMedia,
  visibleItemsCount,
  categoriesWithItems,
  hasBrandImages,
  onMissingMediaClick,
  variant = 'desktop',
}: {
  restaurantId: string
  status: RestaurantStatus
  publicUrl: string
  canEdit: boolean
  /** Itens visíveis sem foto nem vídeo. Zero libera a publicação. */
  missingMedia: number
  visibleItemsCount: number
  categoriesWithItems: number
  hasBrandImages: boolean
  onMissingMediaClick: () => void
  /** `mobile`: o cartão compacto do celular (Tavvi Mobile.dc.html, bMenu). */
  variant?: 'desktop' | 'mobile'
}) {
  const checklistId = useId()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<RestaurantStatus>(initialStatus)
  const [checklistOpen, setChecklistOpen] = useState(initialStatus !== 'active')
  const [unpublishOpen, setUnpublishOpen] = useState(false)
  const isPublished = status === 'active'
  const canPublish = missingMedia === 0 && visibleItemsCount > 0
  const displayUrl = publicUrl.replace(/^https?:\/\//, '')

  function togglePublication(published: boolean) {
    // A action vai DENTRO de startTransition: é o contrato do Next 16 para
    // chamada vinda de evento, e o que traz a revalidação aplicada. Travar o
    // botão é cortesia; quem recusa de novo é o `setPublished` no servidor.
    startTransition(async () => {
      const result = await setPublishedAction({ restaurantId, published })
      if (result.ok) {
        setStatus(published ? 'active' : 'draft')
        toast.add({ title: published ? 'Cardápio publicado' : 'Cardápio despublicado', type: 'success' })
      } else {
        // Sem atualizar a situação: mostrar "no ar" depois de uma falha
        // mentiria sobre o estado do sistema.
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.add({ title: 'Link copiado', type: 'success' })
    } catch {
      // writeText lança fora de contexto seguro e sem permissão.
      toast.add({ title: 'Não foi possível copiar. Copie o endereço à mão.', type: 'error' })
    }
  }

  const warning = !isPublished && missingMedia > 0
    ? `${missingMedia === 1 ? 'Um item visível ainda está sem foto nem vídeo.' : `${missingMedia} itens visíveis ainda estão sem foto nem vídeo.`} O cardápio é um feed de fotos — procure a marca Sem foto na lista abaixo.`
    : isPublished && missingMedia > 0
      ? `${missingMedia === 1 ? 'Um item sem mídia não aparece' : `${missingMedia} itens sem mídia não aparecem`} no feed público.`
      : !isPublished && visibleItemsCount === 0
        ? 'Adicione ao menos um item visível para publicar.'
        : null

  const unpublishConfirm = (
    <PanelConfirm
      open={unpublishOpen}
      onOpenChange={setUnpublishOpen}
      icon={<LuEyeOff />}
      title="Despublicar o cardápio?"
      description="Clientes deixarão de encontrar este cardápio até você publicá-lo novamente."
      confirmLabel="Despublicar"
      cancelLabel="Continuar no ar"
      destructive
      onConfirm={() => togglePublication(false)}
    />
  )

  if (variant === 'mobile') {
    const media = `${visibleItemsCount - missingMedia}/${visibleItemsCount} itens visíveis com mídia`
    return (
      <section className="tv-mpub" aria-label="Publicação do cardápio">
        <div className="tv-mpub-row">
          <span className="tv-mpub-pill"><LuGlobe aria-hidden="true" />{STATUS_LABEL[status]}</span>
          {canEdit && status !== 'suspended' ? (
            <button
              type="button"
              className="tv-mpub-button"
              disabled={pending || (!isPublished && !canPublish)}
              onClick={() => (isPublished ? setUnpublishOpen(true) : togglePublication(true))}
            >
              {pending ? (isPublished ? 'Despublicando…' : 'Publicando…') : isPublished ? 'Despublicar' : 'Publicar'}
            </button>
          ) : null}
        </div>
        <p className="tv-mpub-desc">{STATUS_DESCRIPTION[status]}</p>
        {missingMedia > 0 ? (
          <button type="button" className="tv-mpub-chip" onClick={onMissingMediaClick}>
            <LuImage aria-hidden="true" />{media}
          </button>
        ) : (
          <span className="tv-mpub-chip"><LuImage aria-hidden="true" />{media}</span>
        )}
        {unpublishConfirm}
      </section>
    )
  }

  return (
    <section className="tv-pub" aria-label="Publicação do cardápio">
      <div className="tv-pub-row">
        <span className="tv-pub-pill"><LuGlobe aria-hidden="true" />{STATUS_LABEL[status]}</span>
        <span className="tv-pub-desc">{STATUS_DESCRIPTION[status]}</span>
        {isPublished ? (
          <>
            <button type="button" className="tv-pub-chip is-url" onClick={copyUrl} aria-label={`Copiar endereço ${displayUrl}`}>
              <LuCopy aria-hidden="true" />{displayUrl}
            </button>
            <Link href={publicUrl} target="_blank" rel="noopener noreferrer" className="tv-pub-white">
              <LuExternalLink aria-hidden="true" />Ver no ar
            </Link>
          </>
        ) : null}
        {canEdit && status !== 'suspended' ? (
          <button
            type="button"
            className="tv-pub-ink"
            disabled={pending || (!isPublished && !canPublish)}
            onClick={() => (isPublished ? setUnpublishOpen(true) : togglePublication(true))}
          >
            {isPublished ? <LuEyeOff aria-hidden="true" /> : <LuSend aria-hidden="true" />}
            {pending ? (isPublished ? 'Despublicando…' : 'Publicando…') : isPublished ? 'Despublicar' : 'Publicar cardápio'}
          </button>
        ) : null}
        <button type="button" className="tv-pub-chip" aria-expanded={checklistOpen} aria-controls={checklistId} onClick={() => setChecklistOpen((open) => !open)}>
          Para publicar{checklistOpen ? <LuChevronUp aria-hidden="true" /> : <LuChevronDown aria-hidden="true" />}
        </button>
      </div>

      {checklistOpen ? (
        <div id={checklistId} className="tv-pub-details">
          <div className="tv-pub-checklist">
            <div className="tv-pub-check">
              <LuCircleCheck aria-hidden="true" />
              <span>{categoriesWithItems} {categoriesWithItems === 1 ? 'categoria com itens' : 'categorias com itens'}</span>
            </div>
            <button type="button" className="tv-pub-check" onClick={onMissingMediaClick}>
              {missingMedia > 0 ? <LuCircleAlert aria-hidden="true" /> : <LuCircleCheck aria-hidden="true" />}
              <span>{visibleItemsCount - missingMedia}/{visibleItemsCount} itens visíveis com mídia</span>
              {missingMedia > 0 ? <span className="tv-pub-link">Ver sem mídia</span> : null}
            </button>
            <div className="tv-pub-check">
              <LuImage aria-hidden="true" />
              <span>{hasBrandImages ? 'Logo e capa adicionadas' : 'Logo e capa · recomendação'}</span>
            </div>
          </div>
          {warning ? <p className="tv-pub-warn">{warning}</p> : null}
        </div>
      ) : null}

      {unpublishConfirm}
    </section>
  )
}
