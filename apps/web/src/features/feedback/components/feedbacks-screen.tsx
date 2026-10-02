'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LuArrowDownWideNarrow, LuCheckCheck, LuMessageSquareText, LuTrash2 } from 'react-icons/lu'
import { useShellCounts } from '@/components/shell/console-shell'
import { PageHeader } from '@/components/shell/page-header'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { FeedbackDTO, FeedbackFilter, FeedbackPage } from '@/domain/feedback'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'
import { PanelEmptyState } from '@/features/workspace/components/panel-empty-state'
import {
  cleanupAbandonedFeedbackAction,
  deleteFeedbackAction,
  listFeedbackAction,
  markFeedbackReadAction,
} from '@/server/actions/feedback-admin'
import { usePhone } from '../lib/use-phone'
import { FeedbackCard } from './feedback-card'
import { FeedbackDetail } from './feedback-detail'

// Feedbacks (só administradores): os comentários e fotos anônimos da tela
// inicial do cardápio. Uma tela para desktop e celular, como o Serviço.
export function FeedbacksScreen({
  restaurantId,
  initialPage,
  focus,
}: {
  restaurantId: string
  initialPage: FeedbackPage
  /** Aberto pelo push ou pela central (?f=<id>); `feedback` nulo = já excluído. */
  focus: { id: string; feedback: FeedbackDTO | null } | null
}) {
  const router = useRouter()
  const phone = usePhone()
  const { unreadFeedback, adjustUnreadFeedback } = useShellCounts()
  const [filter, setFilter] = useState<FeedbackFilter>('all')
  const [items, setItems] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [serverPage, setServerPage] = useState(initialPage)
  const [loading, setLoading] = useState<'filter' | 'more' | null>(null)
  const [selected, setSelected] = useState<FeedbackDTO | null>(null)
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState<FeedbackDTO | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const imagesRefreshed = useRef(false)
  const focusHandled = useRef(false)

  // Página nova do servidor (router.refresh depois de uma notificação de
  // feedback novo ou excluído, ou de link assinado vencido): a lista volta à
  // primeira página de "Todos".
  if (initialPage !== serverPage) {
    setServerPage(initialPage)
    setFilter('all')
    setItems(initialPage.items)
    setNextCursor(initialPage.nextCursor)
  }

  const patch = useCallback((id: string, change: Partial<FeedbackDTO>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))
    setSelected((current) => (current?.id === id ? { ...current, ...change } : current))
  }, [])

  // Ação rápida: o contador cai na hora, e o servidor também marca a
  // notificação da própria pessoa sobre este feedback.
  const markRead = useCallback(
    async (feedback: FeedbackDTO) => {
      if (feedback.readAt) return
      patch(feedback.id, { readAt: new Date().toISOString() })
      adjustUnreadFeedback(-1)
      const result = await markFeedbackReadAction({ restaurantId, feedbackId: feedback.id, read: true })
      if (!result.ok) {
        patch(feedback.id, { readAt: null })
        adjustUnreadFeedback(1)
        toast.add({ title: result.error, type: 'error' })
      }
    },
    [adjustUnreadFeedback, patch, restaurantId],
  )

  function open(feedback: FeedbackDTO) {
    setSelected(feedback)
    void markRead(feedback)
  }

  async function markUnread(feedback: FeedbackDTO) {
    if (!feedback.readAt || marking) return
    setMarking(true)
    const result = await markFeedbackReadAction({ restaurantId, feedbackId: feedback.id, read: false })
    setMarking(false)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    patch(feedback.id, { readAt: null })
    adjustUnreadFeedback(1)
    setSelected(null)
  }

  async function confirmDelete() {
    const target = deleting
    if (!target) return
    setDeletePending(true)
    const result = await deleteFeedbackAction({ restaurantId, feedbackId: target.id })
    setDeletePending(false)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    if (!target.readAt) adjustUnreadFeedback(-1)
    setItems((current) => current.filter((item) => item.id !== target.id))
    setSelected((current) => (current?.id === target.id ? null : current))
    setDeleting(null)
    toast.add({ title: 'Feedback excluído', type: 'success' })
  }

  async function changeFilter(next: FeedbackFilter) {
    if (next === filter || loading) return
    setFilter(next)
    setLoading('filter')
    const result = await listFeedbackAction({ restaurantId, filter: next })
    setLoading(null)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    setItems(result.data.items)
    setNextCursor(result.data.nextCursor)
  }

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading('more')
    const result = await listFeedbackAction({ restaurantId, filter, cursor: nextCursor })
    setLoading(null)
    if (!result.ok) {
      toast.add({ title: result.error, type: 'error' })
      return
    }
    setItems((current) => {
      const seen = new Set(current.map((item) => item.id))
      return [...current, ...result.data.items.filter((item) => !seen.has(item.id))]
    })
    setNextCursor(result.data.nextCursor)
  }

  // Links assinados vencem em 1 hora: na primeira imagem que falhar, a
  // página é buscada de novo, uma vez.
  function handleImageError() {
    if (imagesRefreshed.current) return
    imagesRefreshed.current = true
    router.refresh()
  }

  // Rascunhos abandonados (aba fechada no meio do envio) são limpos quando
  // um admin abre esta tela, sem esperar.
  useEffect(() => {
    void cleanupAbandonedFeedbackAction(restaurantId)
  }, [restaurantId])

  // ?f=<id>: abre o feedback uma vez e tira o parâmetro do endereço.
  useEffect(() => {
    if (!focus || focusHandled.current) return
    focusHandled.current = true
    window.history.replaceState(null, '', `/restaurantes/${restaurantId}/feedbacks`)
    if (!focus.feedback) {
      toast.add({ title: 'Este feedback foi excluído.', type: 'info' })
      return
    }
    setSelected(focus.feedback)
    void markRead(focus.feedback)
  }, [focus, markRead, restaurantId])

  const busy = loading !== null

  return (
    <div className="tv-mp tv-fb-page">
      <div className="tv-d-only">
        <PageHeader
          eyebrow="Clientes"
          title="Feedbacks"
          description="Comentários e fotos anônimos enviados pela tela inicial do cardápio."
        />
      </div>
      <div className="tv-m-only tv-mp-head">
        <h1 className="tv-mp-title">Feedbacks</h1>
      </div>

      <div className="tv-fb-toolbar">
        <div className="tv-fb-chips" role="group" aria-label="Filtrar feedbacks">
          <button type="button" className="tv-fb-chip" aria-pressed={filter === 'all'} disabled={busy} onClick={() => void changeFilter('all')}>
            Todos
          </button>
          <button type="button" className="tv-fb-chip" aria-pressed={filter === 'unread'} disabled={busy} onClick={() => void changeFilter('unread')}>
            Não lidos <span className="tv-fb-chip-count">{unreadFeedback > 99 ? '99+' : unreadFeedback}</span>
          </button>
          {loading === 'filter' ? (
            <span className="tv-fb-loading" role="status"><SpinnerRing decorative />Carregando…</span>
          ) : null}
        </div>
        <span className="tv-fb-sort">
          <LuArrowDownWideNarrow aria-hidden="true" />
          <span>Mais recentes</span>
        </span>
      </div>

      {items.length === 0 && loading !== 'filter' ? (
        filter === 'all' ? (
          <PanelEmptyState
            density="section"
            icon={<LuMessageSquareText />}
            title="Nenhum feedback ainda"
            description="Os clientes enviam pela tela inicial do cardápio."
          />
        ) : (
          <PanelEmptyState density="section" icon={<LuCheckCheck />} title="Tudo lido" description="Nenhum feedback esperando leitura." />
        )
      ) : (
        <ul className="tv-fb-list">
          {items.map((item) => (
            <li key={item.id}>
              <FeedbackCard
                feedback={item}
                onOpen={() => open(item)}
                onToggleRead={() => void (item.readAt ? markUnread(item) : markRead(item))}
                onDelete={() => setDeleting(item)}
                onImageError={handleImageError}
              />
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button type="button" className="tv-fb-more" disabled={busy} aria-busy={loading === 'more' || undefined} onClick={() => void loadMore()}>
          {loading === 'more' ? <SpinnerRing decorative /> : null}
          {loading === 'more' ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}

      <FeedbackDetail
        feedback={selected}
        phone={phone}
        marking={marking}
        onClose={() => setSelected(null)}
        onMarkUnread={() => {
          if (selected) void markUnread(selected)
        }}
        onDelete={() => {
          if (selected) setDeleting(selected)
        }}
        onImageError={handleImageError}
      />

      <PanelConfirm
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !deletePending) setDeleting(null)
        }}
        icon={<LuTrash2 />}
        title="Excluir este feedback e as fotos?"
        description="Não dá para desfazer."
        confirmLabel="Excluir"
        pendingLabel="Excluindo…"
        pending={deletePending}
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
