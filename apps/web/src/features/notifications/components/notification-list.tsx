'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import type { IconType } from 'react-icons'
import { LuBellRing, LuCheck, LuCheckCheck, LuMessageSquareText, LuStore, LuUserPlus } from 'react-icons/lu'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { NotificationAction, NotificationDTO, NotificationKind } from '@/domain/notification'
import { fullDateTime, relativeTime } from '@/lib/relative-time'
import { toExternalPath } from '@/lib/route-paths'
import { sendTestNotificationAction } from '@/server/actions/notifications'
import { useNotifications } from '../notifications-provider'
import { EASE_IN, EASE_OUT } from '@/components/motion/easing'

type Variant = 'panel' | 'sheet'

const KIND_ICONS: Record<NotificationKind, IconType> = {
  feedback_received: LuMessageSquareText,
  team_member_joined: LuUserPlus,
  restaurant_joined: LuStore,
  test: LuBellRing,
}

const KIND_ACTIONS: Partial<Record<NotificationKind, NotificationAction[]>> = {
  feedback_received: [{ id: 'open', label: 'Ver feedback', style: 'primary', kind: 'navigate' }],
  team_member_joined: [{ id: 'open', label: 'Ver equipe', style: 'primary', kind: 'navigate' }],
  restaurant_joined: [{ id: 'open', label: 'Abrir restaurante', style: 'primary', kind: 'navigate' }],
}

const cardEnter = {
  initial: { opacity: 0, y: -10, scale: 0.97, height: 0 },
  animate: { opacity: 1, y: 0, scale: 1, height: 'auto', transition: {
    height: { duration: 0.38, ease: EASE_OUT },
    opacity: { duration: 0.3, ease: 'easeOut', delay: 0.09 },
    y: { duration: 0.46, ease: EASE_OUT, delay: 0.04 },
    scale: { duration: 0.46, ease: EASE_OUT, delay: 0.04 },
  } },
}

const groupEnter = {
  initial: { opacity: 0, y: -10, scale: 0.97, height: 0 },
  animate: { opacity: 1, y: 0, scale: 1, height: 'auto', transition: {
    height: { duration: 0.38, ease: EASE_OUT },
    opacity: { duration: 0.3, ease: 'easeOut' },
    y: { duration: 0.46, ease: EASE_OUT },
    scale: { duration: 0.46, ease: EASE_OUT },
  } },
}

const cardExit = (index = 0) => ({ opacity: 0, x: 18, scale: 0.98, height: 0, transition: {
  opacity: { duration: 0.18, ease: EASE_IN, delay: index * 0.06 },
  x: { duration: 0.24, ease: EASE_IN, delay: index * 0.06 },
  scale: { duration: 0.24, ease: EASE_IN, delay: index * 0.06 },
  height: { duration: 0.3, ease: EASE_OUT, delay: 0.15 + index * 0.06 },
} })

// Larguras do skeleton (título, segunda linha do corpo), como no handoff.
const SKELETON_ROWS = [['46%', '62%'], ['58%', '40%'], ['38%', '70%'], ['52%', '48%']] as const

// No painel do desktop, o botão ocupado continua focável (aria-disabled):
// desabilitado, ele perderia o foco e o Tab escaparia do popover de conta.
// As folhas do celular seguem com disabled.
function busyProps(variant: Variant, busy: boolean) {
  return variant === 'panel'
    ? { 'aria-disabled': busy || undefined, 'aria-busy': busy || undefined }
    : { disabled: busy, 'aria-busy': busy || undefined }
}

function unreadLabel(count: number) {
  if (count === 0) return 'Nenhuma não lida'
  if (count === 1) return '1 não lida'
  return `${count > 99 ? '99+' : count} não lidas`
}

// "Hoje" e "Anteriores", no fuso de quem vê. A lista só chega no cliente
// (o primeiro render é o skeleton), então não há divergência de hidratação.
function groupByDay(items: NotificationDTO[]) {
  const today = new Date().toDateString()
  const groups = [
    { label: 'Hoje', items: [] as NotificationDTO[] },
    { label: 'Anteriores', items: [] as NotificationDTO[] },
  ]
  for (const item of items) groups[new Date(item.createdAt).toDateString() === today ? 0 : 1].items.push(item)
  return groups.filter((group) => group.items.length > 0)
}

// Dispara uma notificação de verdade para a própria pessoa. Sem toast de
// sucesso: o toast que vale é o que chega pelo tempo real.
export function TestButton({ variant = 'sheet' }: { variant?: 'sheet' | 'settings' }) {
  const pathname = toExternalPath(usePathname())
  const [sending, startSending] = useTransition()
  const icon = sending ? <SpinnerRing decorative /> : <LuBellRing aria-hidden="true" />
  return (
    <button
      type="button"
      className={variant === 'settings' ? 'tv-notif-device-test is-page' : 'tv-notif-test'}
      {...busyProps('sheet', sending)}
      onClick={() => {
        if (sending) return
        startSending(async () => {
          const result = await sendTestNotificationAction({ url: variant === 'settings' ? '/configuracoes' : pathname })
          if (!result.ok) toast.add({ title: result.error, type: 'error' })
        })
      }}
    >
      {variant === 'settings' ? <span className="tv-notif-device-test-icon" aria-hidden="true">{icon}</span> : icon}
      {sending ? 'Enviando…' : 'Enviar notificação de teste'}
    </button>
  )
}

function NotificationItem({ item, variant, onOpen }: { item: NotificationDTO; variant: Variant; onOpen: (item: NotificationDTO) => void }) {
  const Icon = KIND_ICONS[item.kind]
  const time = (
    <time dateTime={item.createdAt} title={fullDateTime(item.createdAt)} suppressHydrationWarning>
      {relativeTime(item.createdAt)}
    </time>
  )
  return (
    <li>
      <button type="button" className="tv-notif-item" onClick={() => onOpen(item)}>
        <span className="tv-notif-icon" aria-hidden="true"><Icon /></span>
        {variant === 'panel' ? (
          <span className="tv-notif-copy">
            <span className="tv-notif-line"><strong>{item.title}</strong>{time}</span>
            <span>{item.body}</span>
          </span>
        ) : (
          <span className="tv-notif-copy">
            <strong>{item.title}</strong>
            <span>{item.body}</span>
            {time}
          </span>
        )}
      </button>
    </li>
  )
}

function PanelNotificationItem({ item, index, fresh, onOpen, onBodyRead, onBeforeRemove, onItemFocus, onMutationDismiss }: {
  item: NotificationDTO
  index: number
  fresh: boolean
  onOpen: (item: NotificationDTO, url?: string) => void
  onBodyRead: (item: NotificationDTO) => void
  onBeforeRemove: (id: string) => void
  onItemFocus: (id: string) => void
  onMutationDismiss: (item: NotificationDTO) => void
}) {
  const Icon = KIND_ICONS[item.kind]
  // Phase 1 only has navigation actions; mutation actions wait for a concrete
  // server operation instead of rendering a button that cannot complete.
  const actions = (item.actions ?? KIND_ACTIONS[item.kind] ?? []).filter((action) => action.kind === 'navigate').slice(0, 2).sort((left, right) => Number(left.style === 'primary') - Number(right.style === 'primary'))
  const [doneId, setDoneId] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const time = <time dateTime={item.createdAt} title={fullDateTime(item.createdAt)} suppressHydrationWarning>{relativeTime(item.createdAt)}</time>

  async function run(action: NotificationAction) {
    if (doneId) return
    if (action.kind === 'mutation') {
      toast.add({ title: 'Esta ação ainda não está disponível.', type: 'error' })
      return
    }
    setDoneId(action.id)
    window.setTimeout(() => {
      if (action.kind === 'navigate') { onBeforeRemove(item.id); onOpen(item, action.url ?? item.url) }
      else { onBeforeRemove(item.id); onMutationDismiss(item) }
    }, 720)
  }

  return <m.li
    data-notification-id={item.id}
    custom={Math.min(index, 10)}
    className="tv-notif-entry"
    onFocusCapture={() => onItemFocus(item.id)}
    style={{ overflow: 'hidden', transformOrigin: 'top center' }}
    initial={reduced ? false : cardEnter.initial}
    animate={cardEnter.animate}
    exit={reduced ? { opacity: 0, transition: { duration: 0.15 } } : cardExit(Math.min(index, 10))}
  >
    <article className={`tv-notif-card${fresh ? ' is-fresh' : ''}`} aria-labelledby={`tv-notif-title-${item.id}`}>
      <button type="button" className="tv-notif-item" aria-disabled={Boolean(doneId) || undefined} onClick={() => { if (!doneId) { onBeforeRemove(item.id); onBodyRead(item) } }}>
        <span className="tv-notif-icon" aria-hidden="true"><Icon /></span>
        <span className="tv-notif-copy">
          <span className="tv-notif-line"><strong id={`tv-notif-title-${item.id}`}>{item.title}</strong>{time}</span>
          <span>{item.body}</span>
        </span>
      </button>
      {doneId ? <span className="sr-only" aria-live="polite">{actions.find((action) => action.id === doneId)?.doneLabel ?? actions.find((action) => action.id === doneId)?.label}</span> : null}
      {actions.length ? <div className="tv-notif-actions" role="group" aria-label="Ações">
        {actions.map((action) => <button
          key={action.id}
          type="button"
          className={`tv-notif-action is-${action.style ?? 'default'}`}
          data-state={doneId === action.id ? 'done' : doneId ? 'dim' : undefined}
          aria-disabled={Boolean(doneId) || undefined}
          onClick={(event) => { event.stopPropagation(); void run(action) }}
        >
          {doneId === action.id ? <LuCheck aria-hidden="true" /> : null}
          {doneId === action.id ? action.doneLabel ?? action.label : action.label}
        </button>)}
      </div> : null}
    </article>
  </m.li>
}

function LoadMoreButton({ variant }: { variant: Variant }) {
  const { loadingMore, loadMore } = useNotifications()
  return (
    <button
      type="button"
      className="tv-notif-more"
      {...busyProps(variant, loadingMore)}
      onClick={() => {
        if (!loadingMore) void loadMore()
      }}
    >
      {loadingMore ? <SpinnerRing decorative /> : null}
      {loadingMore ? 'Carregando…' : 'Carregar mais'}
    </button>
  )
}

// A anatomia do item em skeleton, com o rótulo do grupo em cima.
function PanelSkeleton() {
  return (
    <div className="tv-notif-skeleton" role="status" aria-busy="true">
      <span className="sr-only">Carregando notificações</span>
      <span className="tv-skel tv-notif-skeleton-label" aria-hidden="true" />
      {SKELETON_ROWS.map(([title, body], index) => (
        <div key={title} className="tv-notif-skeleton-row" aria-hidden="true">
          <div className="tv-notif-skeleton-main">
            <span className="tv-skel tv-notif-skeleton-tile" />
            <span className="tv-notif-skeleton-copy">
              <span className="tv-notif-skeleton-line">
                <span className="tv-skel tv-notif-skeleton-title" style={{ width: title }} />
                <span className="tv-skel tv-notif-skeleton-time" />
              </span>
              <span className="tv-skel tv-notif-skeleton-body" />
              <span className="tv-skel tv-notif-skeleton-body" style={{ width: body }} />
            </span>
          </div>
          {index === 0 ? <div className="tv-notif-skeleton-bar"><span className="tv-skel" /><span className="tv-skel" /></div> : null}
        </div>
      ))}
    </div>
  )
}

// Central do desktop (handoff Notificacoes Premium): cabeçalho fixo com o
// total e "Marcar todas"; abaixo, rolando, a lista por dia.
function PanelList({ onOpen }: { onOpen: (item: NotificationDTO, url?: string) => void }) {
  const { items, unreadCount, hasMore, loading, markingAll, markAsRead, markAllAsRead, dismiss, freshIds } = useNotifications()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const markAllFocused = useRef(false)
  const previousCount = useRef(0)
  const previousIds = useRef<string[]>([])
  const focusedNotificationId = useRef<string | null>(null)
  const [settledEmpty, setSettledEmpty] = useState(true)
  const groupId = useId()
  const showMarkAll = !loading && unreadCount > 0
  const reduced = useReducedMotion()

  function focusAfterRemoval(id: string) {
    const current = document.activeElement
    const owner = current instanceof HTMLElement ? current.closest<HTMLElement>(`[data-notification-id="${CSS.escape(id)}"]`) : null
    if (!owner) return
    const entries = Array.from(document.querySelectorAll<HTMLElement>('.tv-notif-entry[data-notification-id]'))
    const index = entries.indexOf(owner)
    const target = entries[index + 1]?.querySelector<HTMLElement>('.tv-notif-item')
      ?? entries[index - 1]?.querySelector<HTMLElement>('.tv-notif-item')
      ?? headingRef.current
    target?.focus()
  }

  useLayoutEffect(() => {
    if (items.length > 0) setSettledEmpty(false)
    else if (!loading && previousCount.current === 0) setSettledEmpty(true)
    const nextIds = items.map((item) => item.id)
    const focusedId = focusedNotificationId.current
    if (focusedId && !nextIds.includes(focusedId)) {
      const oldIndex = previousIds.current.indexOf(focusedId)
      const targetId = nextIds[Math.min(Math.max(oldIndex, 0), nextIds.length - 1)]
      const target = targetId
        ? document.querySelector<HTMLElement>(`[data-notification-id="${CSS.escape(targetId)}"] .tv-notif-item`)
        : headingRef.current
      target?.focus()
      focusedNotificationId.current = null
    }
    previousCount.current = items.length
    previousIds.current = nextIds
  }, [items, loading])

  // "Marcar todas" some quando zera a contagem. Se o foco estava nele, vai
  // para o título: sem isso cairia no <body> e o Tab sairia do popover.
  useEffect(() => {
    if (showMarkAll || !markAllFocused.current) return
    markAllFocused.current = false
    headingRef.current?.focus()
  }, [showMarkAll])

  return (
    <div className="tv-notif is-panel">
      <div className="tv-notif-header">
        <div className="tv-notif-heading">
          <h3 ref={headingRef} tabIndex={-1}>Notificações</h3>
          {loading ? <span className="tv-skel" aria-hidden="true" /> : <span>{unreadLabel(unreadCount)}</span>}
        </div>
        {showMarkAll ? (
          <button
            type="button"
            className="tv-notif-markall"
            {...busyProps('panel', markingAll)}
            onFocus={() => { markAllFocused.current = true }}
            // Só conta como saída quando o foco foi para outro lugar; sumir
            // da tela também pode disparar blur, e aí o título assume.
            onBlur={(event) => { if (event.relatedTarget) markAllFocused.current = false }}
            onClick={() => {
              if (!markingAll) { setSettledEmpty(false); void markAllAsRead() }
            }}
          >
            {markingAll ? <SpinnerRing decorative /> : <LuCheckCheck aria-hidden="true" />}
            {markingAll ? 'Marcando…' : 'Marcar todas como lidas'}
          </button>
        ) : null}
      </div>

      <div className="tv-notif-scroll">
        {loading ? (
          <PanelSkeleton />
        ) : (
          <>
            <AnimatePresence initial={false} onExitComplete={() => { if (items.length === 0) setSettledEmpty(true) }}>
              {groupByDay(items).map((group, groupIndex) => <m.div
                key={group.label}
                className="tv-notif-group"
                initial={reduced ? false : groupEnter.initial}
                animate={groupEnter.animate}
                exit={reduced ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, height: 0, marginBottom: -14, transition: { opacity: { duration: 0.18 }, height: { duration: 0.3, delay: 0.16, ease: EASE_OUT }, marginBottom: { duration: 0.3, delay: 0.16, ease: EASE_OUT } } }}
                style={{ overflow: 'hidden' }}
              >
                <h4 id={`${groupId}-${groupIndex}`} className="tv-notif-group-label">{group.label}</h4>
                <ul className="tv-notif-list" aria-labelledby={`${groupId}-${groupIndex}`}>
                  <AnimatePresence initial={false} propagate>
                    {group.items.map((item) => <PanelNotificationItem
                      key={item.id}
                      item={item}
                      index={items.findIndex((candidate) => candidate.id === item.id)}
                      fresh={freshIds.has(item.id)}
                      onOpen={onOpen}
                      onBodyRead={(selected) => { void markAsRead(selected.id) }}
                      onBeforeRemove={focusAfterRemoval}
                      onItemFocus={(id) => { focusedNotificationId.current = id }}
                      onMutationDismiss={(selected) => dismiss(selected.id)}
                    />)}
                  </AnimatePresence>
                </ul>
              </m.div>)}
            </AnimatePresence>
            {!items.length && settledEmpty ? <div className="tv-notif-empty tv-notif-empty-delayed">
              <span className="tv-notif-empty-icon" aria-hidden="true"><LuCheckCheck /></span>
              <strong>Tudo em dia</strong>
              <span>Nenhuma notificação nova.</span>
            </div> : null}
          </>
        )}

        {hasMore && !loading ? <LoadMoreButton variant="panel" /> : null}
      </div>
    </div>
  )
}

// Folha do painel no celular e subtela Conta do console: o teste em cima,
// depois as não lidas.
function SheetList({ onOpen }: { onOpen: (item: NotificationDTO) => void }) {
  const { items, unreadCount, hasMore, loading, markingAll, markAllAsRead } = useNotifications()
  return (
    <div className="tv-notif">
      <TestButton variant="sheet" />
      <div className="tv-notif-head">
        <h3 className="tv-notif-title">Não lidas{unreadCount > 0 ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : ''}</h3>
        <button
          type="button"
          className="tv-notif-markall"
          disabled={unreadCount === 0 || markingAll}
          aria-busy={markingAll || undefined}
          onClick={() => void markAllAsRead()}
        >
          {markingAll ? <SpinnerRing decorative /> : <LuCheckCheck aria-hidden="true" />}
          {markingAll ? 'Marcando…' : 'Marcar todas como lidas'}
        </button>
      </div>

      {loading ? (
        <p className="tv-notif-state" role="status"><SpinnerRing decorative />Carregando…</p>
      ) : items.length === 0 ? (
        <div className="tv-notif-empty">
          <strong>Tudo em dia</strong>
          <span>Nenhuma notificação nova.</span>
        </div>
      ) : (
        <ul className="tv-notif-list">
          {items.map((item) => <NotificationItem key={item.id} item={item} variant="sheet" onOpen={onOpen} />)}
        </ul>
      )}

      {hasMore ? <LoadMoreButton variant="sheet" /> : null}
    </div>
  )
}

// As não lidas, mais novas primeiro (como no zamai.os): tocar marca como
// lida e abre o destino. `panel` é a central ao lado do popover de conta no
// desktop; `sheet`, a folha do painel no celular e a subtela Conta do
// console, que conserva os controles próprios do mobile.
export function NotificationList({ variant = 'sheet', onNavigate }: { variant?: Variant; onNavigate?: () => void }) {
  const router = useRouter()
  const { markAsRead } = useNotifications()

  function open(item: NotificationDTO, url?: string) {
    void markAsRead(item.id)
    onNavigate?.()
    router.push(url ?? item.url)
  }

  return variant === 'panel' ? <PanelList onOpen={open} /> : <SheetList onOpen={open} />
}
