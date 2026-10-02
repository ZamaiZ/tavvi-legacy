'use client'

import { useEffect, useId, useRef, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { IconType } from 'react-icons'
import { LuBellRing, LuCheckCheck, LuMessageSquareText, LuStore, LuUserPlus } from 'react-icons/lu'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { NotificationDTO, NotificationKind } from '@/domain/notification'
import { fullDateTime, relativeTime } from '@/lib/relative-time'
import { toExternalPath } from '@/lib/route-paths'
import { sendTestNotificationAction } from '@/server/actions/notifications'
import { useNotifications } from '../notifications-provider'

type Variant = 'panel' | 'sheet'

const KIND_ICONS: Record<NotificationKind, IconType> = {
  feedback_received: LuMessageSquareText,
  team_member_joined: LuUserPlus,
  restaurant_joined: LuStore,
  test: LuBellRing,
}

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
// sucesso aqui: o toast que vale é o que chega pelo tempo real — se ele não
// aparecer, é ali que está o problema. No painel, é a segunda linha do grupo
// "Neste aparelho", com o ícone na coluna do tile de cima.
function TestButton({ variant }: { variant: Variant }) {
  const pathname = toExternalPath(usePathname())
  const [sending, startSending] = useTransition()
  const icon = sending ? <SpinnerRing decorative /> : <LuBellRing aria-hidden="true" />
  return (
    <button
      type="button"
      className={variant === 'panel' ? 'tv-notif-device-test' : 'tv-notif-test'}
      {...busyProps(variant, sending)}
      onClick={() => {
        if (sending) return
        startSending(async () => {
          const result = await sendTestNotificationAction({ url: pathname })
          if (!result.ok) toast.add({ title: result.error, type: 'error' })
        })
      }}
    >
      {variant === 'panel' ? <span className="tv-notif-device-test-icon" aria-hidden="true">{icon}</span> : icon}
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
      {SKELETON_ROWS.map(([title, body]) => (
        <div key={title} className="tv-notif-skeleton-row" aria-hidden="true">
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
      ))}
    </div>
  )
}

// Central do desktop (handoff Notificacoes Premium): cabeçalho fixo com o
// total e "Marcar todas"; abaixo, rolando, o grupo "Neste aparelho" e a
// lista por dia.
function PanelList({ onOpen }: { onOpen: (item: NotificationDTO) => void }) {
  const { items, unreadCount, hasMore, loading, markingAll, markAllAsRead } = useNotifications()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const markAllFocused = useRef(false)
  const groupId = useId()
  const showMarkAll = !loading && unreadCount > 0

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
              if (!markingAll) void markAllAsRead()
            }}
          >
            {markingAll ? <SpinnerRing decorative /> : <LuCheckCheck aria-hidden="true" />}
            {markingAll ? 'Marcando…' : 'Marcar todas como lidas'}
          </button>
        ) : null}
      </div>

      <div className="tv-notif-scroll">
        <div className="tv-notif-device">
          <PwaNotificationsAction variant="group" />
          <TestButton variant="panel" />
        </div>

        {loading ? (
          <PanelSkeleton />
        ) : items.length === 0 ? (
          <div className="tv-notif-empty">
            <span className="tv-notif-empty-icon" aria-hidden="true"><LuCheckCheck /></span>
            <strong>Tudo em dia</strong>
            <span>Nenhuma notificação nova.</span>
          </div>
        ) : (
          groupByDay(items).map((group, index) => (
            <div key={group.label} className="tv-notif-group">
              <h4 id={`${groupId}-${index}`} className="tv-notif-group-label">{group.label}</h4>
              <ul className="tv-notif-list" aria-labelledby={`${groupId}-${index}`}>
                {group.items.map((item) => <NotificationItem key={item.id} item={item} variant="panel" onOpen={onOpen} />)}
              </ul>
            </div>
          ))
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
// console (que montam o "Neste aparelho" por fora).
export function NotificationList({ variant = 'sheet', onNavigate }: { variant?: Variant; onNavigate?: () => void }) {
  const router = useRouter()
  const { markAsRead } = useNotifications()

  function open(item: NotificationDTO) {
    void markAsRead(item.id)
    onNavigate?.()
    router.push(item.url)
  }

  return variant === 'panel' ? <PanelList onOpen={open} /> : <SheetList onOpen={open} />
}
