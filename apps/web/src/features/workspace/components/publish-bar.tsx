'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  RiExternalLinkLine,
  RiEyeOffLine,
  RiGlobalLine,
  RiSendPlaneLine,
} from 'react-icons/ri'
import { Copyable } from '@/components/shell/copyable'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { RestaurantStatus } from '@/domain/restaurant'
import { setPublishedAction } from '@/server/actions/restaurants'

const STATUS_DESCRIPTION: Record<RestaurantStatus, string> = {
  active: 'Quem encostar o celular na plaquinha vê o cardápio.',
  draft: 'Só você vê. Publique quando terminar de montar.',
  suspended: 'Fale com o administrador da plataforma.',
}

const STATUS_LABEL: Record<RestaurantStatus, string> = {
  active: 'No ar',
  draft: 'Rascunho',
  suspended: 'Suspenso',
}

export function PublishBar({
  restaurantId,
  status: initialStatus,
  publicUrl,
  canEdit,
  missingMedia,
  visibleItemsCount,
  categoriesWithItems,
  hasBrandImages,
  onMissingMediaClick,
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
}) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<RestaurantStatus>(initialStatus)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [unpublishOpen, setUnpublishOpen] = useState(false)

  function togglePublication(published: boolean) {
    // A action vai DENTRO de startTransition: é o contrato documentado do
    // Next 16.3.5 para chamada vinda de manipulador de evento. Fora dela, a
    // revalidação pode não voltar aplicada, e a tela fica velha depois de uma
    // operação que deu certo.
    startTransition(async () => {
      const result = await setPublishedAction({ restaurantId, published })
      if (result.ok) {
        setStatus(published ? 'active' : 'draft')
        toast.add({
          title: published ? 'Cardápio publicado' : 'Cardápio despublicado',
          type: 'success',
        })
      } else {
        // Sem atualizar a situação: a gravação falhou, e uma faixa mostrando
        // "no ar" depois de uma falha mente sobre o state do sistema.
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  const isPublished = status === 'active'

  return (
    // `Card`, e não `rounded-xl border bg-surface-2` montado à mão. O
    // primitivo existia desde a Fase 1 e nunca tinha sido importado por
    // nenhuma tela — era uma das 42 peças do sistema de design que o painel
    // ignorava, e é por isso que cada superfície tinha números um pouco
    // diferentes.
    <Card className="tv-publish-bar mb-6 flex-row flex-wrap items-center gap-x-3 gap-y-2 rounded-[22px] border-border/70 p-3 shadow-[var(--shadow-1)] sm:p-4">
      <span className="flex items-center gap-2 text-small font-semibold">
        <RiGlobalLine
          className={isPublished ? 'size-4 text-status-active' : 'size-4 text-muted-foreground'}
          aria-hidden="true"
        />
        {STATUS_LABEL[status]}
      </span>

      <p className="min-w-0 flex-1 text-small text-muted-foreground">{STATUS_DESCRIPTION[status]}</p>

      <button type="button" className="tv-publish-checklist-toggle" aria-expanded={checklistOpen} onClick={() => setChecklistOpen((open) => !open)}>Para publicar <span>{checklistOpen ? '−' : '+'}</span></button>
      <div className={`tv-publish-checklist${checklistOpen ? ' is-open' : ''}`} aria-label="Para publicar">
        <span><b>{categoriesWithItems}</b> {categoriesWithItems === 1 ? 'categoria com itens' : 'categorias com itens'}</span>
        <button type="button" className={`tv-publish-media-check ${missingMedia ? 'is-warning' : 'is-ready'}`} onClick={onMissingMediaClick}><b>{visibleItemsCount - missingMedia}/{visibleItemsCount}</b> itens visíveis com mídia{missingMedia > 0 ? ' · Ver sem mídia' : ''}</button>
        <span className="is-recommendation">{hasBrandImages ? 'Logo e capa adicionadas' : 'Logo e capa · recomendação'}</span>
      </div>

      {/* O endereço público passa a ser COPIÁVEL. Ele é a coisa que o dono
          mais precisa levar para fora do painel — vai na plaquinha, no
          Instagram, no WhatsApp — e até aqui era texto morto. */}
      {isPublished ? (
        <Copyable
          value={publicUrl}
          label="endereço do cardápio"
          className="order-last w-full min-w-0 sm:order-none sm:w-[min(24rem,38vw)]"
        />
      ) : null}

      <div className="ml-auto flex shrink-0 flex-wrap gap-2">
        {isPublished ? (
          // Link estilizado, e não Button com `render`. A doc local do Base UI
          // (`button.md:150`) é explícita: âncora tem semântica própria e não
          // deve receber semântica de botão pelo `render`. Era esta a origem
          // do erro de console "expected a native <button>".
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            <RiExternalLinkLine className="size-4" />
            Ver no ar
          </Link>
        ) : null}

        {canEdit && status !== 'suspended' ? (
          <Button
            // Travar o botão é CORTESIA. A regra é o `setPublished`, que
            // recusa de novo no servidor — e quem chamar a action na mão
            // continua barrado.
            disabled={pending || (!isPublished && (missingMedia > 0 || visibleItemsCount === 0))}
            variant={isPublished ? 'outline' : 'default'}
            onClick={() => isPublished ? setUnpublishOpen(true) : togglePublication(true)}
          >
            {pending ? (
              <Spinner className="size-4" />
            ) : isPublished ? (
              <RiEyeOffLine className="size-4" />
            ) : (
              <RiSendPlaneLine className="size-4" />
            )}
            {pending
              ? isPublished ? 'Despublicando…' : 'Publicando…'
              : isPublished ? 'Despublicar' : 'Publicar cardápio'}
          </Button>
        ) : null}
      </div>

      {!isPublished && missingMedia > 0 ? (
        <p className="w-full text-small text-status-suspended">
          {missingMedia === 1
            ? 'Um item visível ainda está sem foto nem vídeo.'
            : `${missingMedia} itens visíveis ainda estão sem foto nem vídeo.`}{' '}
          O cardápio é um feed de fotos — procure a marca{' '}
          <strong>Sem foto</strong> na lista abaixo.
        </p>
      ) : null}
      {isPublished && missingMedia > 0 ? <p className="tv-publish-reason">{missingMedia} itens sem mídia não aparecem no feed público.</p> : null}
      {!isPublished && missingMedia === 0 && visibleItemsCount === 0 ? <p className="tv-publish-reason">Adicione ao menos um item visível para publicar.</p> : null}
      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Despublicar o cardápio?</AlertDialogTitle>
            <AlertDialogDescription>Clientes deixarão de encontrar este cardápio até você publicá-lo novamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar no ar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => togglePublication(false)}>Despublicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
