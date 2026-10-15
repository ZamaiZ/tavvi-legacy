'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  LuArrowDownLeft,
  LuArrowRightLeft,
  LuBell,
  LuCheck,
  LuCheckCheck,
  LuClock3,
  LuHistory,
  LuTrash2,
  LuUserRound,
  LuVolume2,
  LuBellOff,
} from 'react-icons/lu'
import { PageHeader } from '@/components/shell/page-header'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { SpinnerRing } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from '@/components/ui/toast'
import {
  serviceCallFromRow,
  type ServiceCallDTO,
  type ServiceCallEventDTO,
  type ServiceCallPage,
  type ServiceCallStatus,
  type ServiceCallTeamMemberDTO,
} from '@/domain/service-call'
import type { MemberRole } from '@/domain/invite'
import type { OrderableMenuCategoryDTO } from '@/domain/orders'
import type { TableAccountDTO } from '@/domain/table-account'
import { fullDateTime, relativeTime } from '@/lib/relative-time'
import {
  claimServiceCallAction,
  getServiceCallsDashboardAction,
  listServiceCallEventsAction,
  listServiceCallsAction,
  resolveServiceCallAction,
  transferServiceCallAction,
} from '@/server/actions/service-calls'
import { CallList } from './call-list'
import { ServiceCallTransferDialog } from './service-call-transfer-dialog'
import { callServiceDuration, callWaitDuration, formatCallTime, formatElapsed } from '../service-call-time'
import { disableServiceCallSound, enableServiceCallSoundFromGesture, isServiceCallSoundEnabled } from '../call-sound'
import { useServiceCallsRealtimeContext } from '../service-calls-realtime-context'
import { OrderEntry } from '@/features/orders/components/order-entry'
import { PanelConfirm } from '@/features/workspace/components/panel-confirm'

const STATUS_LABELS: Record<ServiceCallStatus, string> = {
  pending: 'Aguardando',
  in_progress: 'Em atendimento',
  resolved: 'Concluídos',
}

type QueueData = Record<ServiceCallStatus, ServiceCallPage>
const CALL_STATUSES: readonly ServiceCallStatus[] = ['pending', 'in_progress', 'resolved']
const CALL_PAGE_SIZE = 100

export function CallsScreen({
  restaurantId,
  userId,
  role,
  serverNow,
  initialPending,
  initialInProgress,
  initialResolved,
  initialTeam,
  focusedCall,
  orderableMenu,
  initialAccount,
}: {
  restaurantId: string
  userId: string
  role: MemberRole
  serverNow: string
  initialPending: ServiceCallPage
  initialInProgress: ServiceCallPage
  initialResolved: ServiceCallPage
  initialTeam: ServiceCallTeamMemberDTO[]
  focusedCall: ServiceCallDTO | null
  orderableMenu: OrderableMenuCategoryDTO[]
  initialAccount: TableAccountDTO | null
}) {
  const { subscribe, updatePendingCount, refreshPendingCount } = useServiceCallsRealtimeContext()
  const mobile = useIsMobile()
  const [queues, setQueues] = useState<QueueData>({
    pending: initialPending,
    in_progress: initialInProgress,
    resolved: initialResolved,
  })
  const [focusedCallState, setFocusedCallState] = useState(focusedCall)
  const [team, setTeam] = useState(initialTeam)
  const [filter, setFilter] = useState<ServiceCallStatus>(
    focusedCall?.status ?? (initialPending.items.length ? 'pending' : initialInProgress.items.length ? 'in_progress' : 'resolved'),
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    focusedCall?.id ?? initialPending.items[0]?.id ?? initialInProgress.items[0]?.id ?? initialResolved.items[0]?.id ?? null,
  )
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const refreshRevision = useRef(0)
  const eventsRevision = useRef(0)
  const [events, setEvents] = useState<ServiceCallEventDTO[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, startTransition] = useTransition()
  const [discardOpen, setDiscardOpen] = useState(false)
  const pendingSelection = useRef<(() => void) | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [now, setNow] = useState(() => Date.parse(serverNow))
  const [orderDraft, setOrderDraft] = useState(false)

  const allCalls = useMemo(
    () => [...queues.pending.items, ...queues.in_progress.items, ...queues.resolved.items],
    [queues],
  )
  const memberNames = useMemo(() => new Map(team.map((member) => [member.userId, member.displayName])), [team])
  const selected = allCalls.find((call) => call.id === selectedId)
    ?? (focusedCallState?.id === selectedId ? focusedCallState : null)
  const currentQueue = queues[filter]
  const canTransfer = role === 'admin'
  const isAssignee = selected?.assignedTo === userId

  useEffect(() => { setSoundEnabled(isServiceCallSoundEnabled()) }, [])

  useEffect(() => {
    const serverStart = Date.parse(serverNow)
    const monotonicStart = performance.now()
    const timer = window.setInterval(() => setNow(serverStart + performance.now() - monotonicStart), 1000)
    return () => window.clearInterval(timer)
  }, [serverNow])

  const refresh = useCallback(async (messages: unknown[] = [], includeEvents = false) => {
    const revision = ++refreshRevision.current
    try {
      const selectedCallId = selectedIdRef.current
      const dashboardResult = await getServiceCallsDashboardAction({ restaurantId, selectedCallId, includeEvents })
      if (revision !== refreshRevision.current) return
      if (!dashboardResult.ok) {
        console.error('[service-calls] dashboard refresh failed', dashboardResult.error)
        void refreshPendingCount()
        return
      }
      const dashboard = dashboardResult.data
      for (const [field, error] of Object.entries(dashboard.errors)) {
        console.error(`[service-calls] dashboard ${field} refresh failed`, error)
      }
      const refreshedQueues: Partial<QueueData> = {
        ...(dashboard.pending ? { pending: dashboard.pending } : {}),
        ...(dashboard.inProgress ? { in_progress: dashboard.inProgress } : {}),
        ...(dashboard.resolved ? { resolved: dashboard.resolved } : {}),
      }
      const latestById = new Map<string, ServiceCallDTO>()
      for (const message of messages) {
        const call = readServiceCallBroadcast(message)
        if (call?.restaurantId === restaurantId) latestById.set(call.id, call)
      }
      if (selectedCallId && selectedIdRef.current === selectedCallId && dashboard.selectedCall) {
        latestById.set(dashboard.selectedCall.id, dashboard.selectedCall)
      }
      const removedSelectedCall = selectedCallId !== null
        && selectedIdRef.current === selectedCallId
        && dashboard.selectedCall === null

      if (selectedCallId && selectedIdRef.current === selectedCallId && dashboard.selectedCall !== undefined) {
        setFocusedCallState(dashboard.selectedCall)
      }
      setQueues((current) => mergeQueues(
        current,
        refreshedQueues,
        [...latestById.values()],
        removedSelectedCall && selectedCallId ? [selectedCallId] : [],
      ))
      if (dashboard.team !== undefined) setTeam(dashboard.team)
      if (dashboard.pendingCount !== undefined) updatePendingCount(dashboard.pendingCount)
      else void refreshPendingCount()
      if (includeEvents && dashboard.events !== undefined && selectedIdRef.current === selectedCallId) {
        setEvents(dashboard.events)
      }
    } catch (error) {
      if (revision === refreshRevision.current) console.error('[service-calls] refresh failed', error)
    } finally {
      if (revision === refreshRevision.current) setRefreshing(false)
    }
  }, [restaurantId, refreshPendingCount, updatePendingCount])

  const loadEvents = useCallback(async (callId: string) => {
    const revision = ++eventsRevision.current
    setEventsLoading(true)
    try {
      const result = await listServiceCallEventsAction({ restaurantId, callId })
      if (revision !== eventsRevision.current || selectedIdRef.current !== callId) return
      setEvents(result.ok ? result.data : [])
      if (!result.ok) console.error('[service-calls] event history refresh failed', result.error)
    } catch (error) {
      if (revision === eventsRevision.current) {
        setEvents([])
        console.error('[service-calls] event history refresh failed', error)
      }
    } finally {
      if (revision === eventsRevision.current) setEventsLoading(false)
    }
  }, [restaurantId])

  const onRealtime = useCallback((messages?: unknown[]) => {
    setRefreshing(true)
    const selectedCallId = selectedIdRef.current
    const shouldRefreshEvents = selectedCallId !== null && (
      !messages?.length || messages.some((message) => readServiceCallBroadcast(message)?.id === selectedCallId)
    )
    void refresh(messages, shouldRefreshEvents)
  }, [refresh])

  useEffect(() => subscribe(onRealtime), [onRealtime, subscribe])

  useEffect(() => {
    if (!selectedId) {
      eventsRevision.current += 1
      setEvents([])
      setEventsLoading(false)
      return
    }
    void loadEvents(selectedId)
    return () => { eventsRevision.current += 1 }
  }, [loadEvents, selectedId])

  useEffect(() => {
    const inCurrentQueue = queues[filter].items.some((call) => call.id === selectedId)
    const movedCall = allCalls.find((call) => call.id === selectedId)
      ?? (focusedCallState?.id === selectedId ? focusedCallState : null)
    if (selectedId && !inCurrentQueue) {
      if (movedCall && movedCall.status !== filter) setFilter(movedCall.status)
      else if (!movedCall) setSelectedId(queues[filter].items[0]?.id ?? null)
    } else if (!selectedId && queues[filter].items[0]) {
      setSelectedId(queues[filter].items[0].id)
    }
  }, [allCalls, filter, focusedCallState, queues, selectedId])

  function updateCall(call: ServiceCallDTO) {
    setQueues((current) => {
      const alreadyLoadedInDestination = current[call.status].items.some((item) => item.id === call.id)
      const next: QueueData = {
        pending: { ...current.pending, items: current.pending.items.filter((item) => item.id !== call.id) },
        in_progress: { ...current.in_progress, items: current.in_progress.items.filter((item) => item.id !== call.id) },
        resolved: { ...current.resolved, items: current.resolved.items.filter((item) => item.id !== call.id) },
      }
      if (alreadyLoadedInDestination) {
        const queue = next[call.status]
        next[call.status] = { ...queue, items: sortCalls([...queue.items, call], call.status) }
      }
      return next
    })
    setFocusedCallState(call)
    setFilter(call.status)
    setSelectedId(call.id)
  }

  function claim(call: ServiceCallDTO) {
    if (busy || call.status !== 'pending') return
    startTransition(async () => {
      try {
        const result = await claimServiceCallAction({ restaurantId, callId: call.id })
        if (!result.ok) { toast.add({ title: result.error, type: 'error' }); void refresh([], true); return }
        updateCall(result.data.call)
        if (result.data.outcome === 'claim_conflict') {
          const owner = result.data.call.assignedTo ? memberNames.get(result.data.call.assignedTo) : null
          toast.add({
            title: result.data.call.status === 'resolved' ? 'Este chamado já foi concluído.' : 'Outra pessoa assumiu este chamado primeiro.',
            description: result.data.call.status === 'resolved'
              ? 'O histórico foi atualizado com a conclusão.'
              : owner ? `Responsável atual: ${owner}.` : 'A fila foi sincronizada com o estado atual.',
            type: 'info',
          })
          void refresh([], true)
          return
        }
        toast.add({ title: result.data.outcome === 'already_assigned' ? 'Este chamado já está com você.' : 'Chamado assumido.', type: 'success' })
        void refresh([], true)
      } catch {
        toast.add({ title: 'Não foi possível confirmar o aceite.', description: 'Atualizando a fila para conferir o responsável atual.', type: 'error' })
        void refresh([], true)
      }
    })
  }

  function resolve(call: ServiceCallDTO) {
    if (busy || call.status !== 'in_progress' || call.assignedTo !== userId) return
    startTransition(async () => {
      try {
        const result = await resolveServiceCallAction({ restaurantId, callId: call.id })
        if (!result.ok) { toast.add({ title: result.error, type: 'error' }); void refresh([], true); return }
        updateCall(result.data.call)
        if (result.data.outcome === 'resolve_conflict') {
          toast.add({
            title: result.data.call.status === 'resolved' ? 'Outra pessoa concluiu este chamado.' : 'O responsável mudou antes da conclusão.',
            description: 'O chamado foi atualizado na fila.',
            type: 'info',
          })
          void refresh([], true)
          return
        }
        toast.add({ title: result.data.outcome === 'already_resolved' ? 'Este chamado já foi concluído.' : 'Atendimento concluído.', type: 'success' })
        void refresh([], true)
      } catch {
        toast.add({ title: 'Não foi possível confirmar a conclusão.', description: 'Atualizando o estado do chamado.', type: 'error' })
        void refresh([], true)
      }
    })
  }

  function transfer(assigneeId: string) {
    if (busy || orderDraft || !selected || selected.status !== 'in_progress' || !canTransfer) return
    startTransition(async () => {
      try {
        const result = await transferServiceCallAction({ restaurantId, callId: selected.id, assigneeId })
        if (!result.ok) { toast.add({ title: result.error, type: 'error' }); void refresh([], true); return }
        updateCall(result.data.call)
        setTransferOpen(false)
        if (result.data.outcome === 'transfer_conflict') {
          toast.add({ title: 'Este chamado não está mais em atendimento.', description: 'A fila foi sincronizada com o estado atual.', type: 'info' })
          void refresh([], true)
          return
        }
        toast.add({ title: result.data.outcome === 'already_assigned' ? 'Este membro já está responsável.' : 'Chamado transferido.', type: 'success' })
        void refresh([], true)
      } catch {
        toast.add({ title: 'Não foi possível confirmar a transferência.', description: 'Confira o responsável atual na fila.', type: 'error' })
        void refresh([], true)
      }
    })
  }

  async function loadMore() {
    const cursor = currentQueue.nextCursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await listServiceCallsAction({ restaurantId, status: filter, cursor })
      if (!result.ok) { toast.add({ title: result.error, type: 'error' }); return }
      setQueues((current) => {
        const queue = current[filter]
        const merged = [...queue.items, ...result.data.items.filter((item) => item.status === filter && !queue.items.some((entry) => entry.id === item.id))]
        return { ...current, [filter]: { items: merged, hasMore: result.data.hasMore, nextCursor: result.data.nextCursor } }
      })
    } catch {
      toast.add({ title: 'Falha de conexão ao carregar os chamados.', type: 'error' })
    } finally {
      setLoadingMore(false)
    }
  }

  async function toggleSound() {
    if (soundEnabled) {
      disableServiceCallSound()
      setSoundEnabled(false)
      return
    }
    const enabled = await enableServiceCallSoundFromGesture()
    setSoundEnabled(enabled)
    if (!enabled) toast.add({ title: 'Este navegador não permitiu ativar o som.', description: 'A fila e as notificações continuam funcionando.', type: 'info' })
  }

  function selectStatus(status: ServiceCallStatus) {
    const selectedStaysInFilter = queues[status].items.some((call) => call.id === selectedId)
    const nextCall = selectedStaysInFilter
      ? selected
      : queues[status].items[0] ?? null
    const apply = () => {
      setFilter(status)
      if (!selectedStaysInFilter) {
        setOrderDraft(false)
        setSelectedId(nextCall?.id ?? null)
      }
    }
    if (selected && nextCall?.id !== selected.id && orderDraft) {
      pendingSelection.current = apply
      setDiscardOpen(true)
      return
    }
    apply()
  }

  function selectCall(call: ServiceCallDTO) {
    const apply = () => {
      if (call.id !== selectedId) setOrderDraft(false)
      setSelectedId(call.id)
    }
    if (call.id !== selectedId && selected && orderDraft) {
      pendingSelection.current = apply
      setDiscardOpen(true)
      return
    }
    apply()
  }

  const callCount = (status: ServiceCallStatus) => `${queues[status].items.length}${queues[status].hasMore ? '+' : ''}`
  const selectedOwner = selected?.assignedTo ? memberNames.get(selected.assignedTo) ?? 'Membro da equipe' : null
  const selectedActor = selected?.resolvedBy ? memberNames.get(selected.resolvedBy) ?? 'Membro da equipe' : null

  return <div className="tv-calls-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}`} backLabel="Cardápio" />
    <PageHeader eyebrow="Atendimento da equipe" title="Chamados" description="Acompanhe cada solicitação da fila até a conclusão, com responsável e tempos registrados." />

    <section className="tv-calls-summary" aria-label="Resumo dos chamados">
      {(['pending', 'in_progress', 'resolved'] as const).map((status) => {
        const Icon = status === 'pending' ? LuBell : status === 'in_progress' ? LuUserRound : LuCheckCheck
        return <button type="button" key={status} className={`tv-call-summary-card is-${status}${filter === status ? ' is-active' : ''}`} aria-pressed={filter === status} onClick={() => selectStatus(status)}>
          <span className="tv-call-summary-icon"><Icon aria-hidden="true" /></span>
          <span className="tv-call-summary-copy"><small>{STATUS_LABELS[status]}</small><strong>{callCount(status)}</strong></span>
          <span className="tv-call-summary-arrow" aria-hidden="true"><LuArrowDownLeft /></span>
        </button>
      })}
    </section>

    <div className="tv-calls-toolbar">
      <div className="tv-calls-tools">
        <span className="tv-calls-live"><i aria-hidden="true" />Atualizado ao vivo</span>
        <button type="button" className={`tv-calls-sound ${soundEnabled ? 'is-on' : ''}`} onClick={() => void toggleSound()}>{soundEnabled ? <LuVolume2 aria-hidden="true" /> : <LuBellOff aria-hidden="true" />}{soundEnabled ? 'Som ativo' : 'Ativar som'}</button>
      </div>
    </div>

    <div className="tv-calls-layout">
      <section className="tv-calls-list-panel" aria-label={`Fila: ${STATUS_LABELS[filter]}`}>
        <div className="tv-calls-list-head">
          <div><strong>{filter === 'pending' ? 'Aguardando alguém da equipe' : filter === 'in_progress' ? 'Em atendimento agora' : 'Histórico de atendimentos'}</strong><span>{filter === 'resolved' ? 'Mais recentes primeiro' : 'Mais antigos primeiro'}</span></div>
          {refreshing ? <span className="tv-calls-refreshing"><SpinnerRing decorative /> Atualizando</span> : <span className="tv-calls-list-count">{callCount(filter)} {filter === 'resolved' ? 'itens' : 'na fila'}</span>}
        </div>
        <CallList items={currentQueue.items} selectedId={selectedId} onSelect={selectCall} status={filter} memberNames={memberNames} now={now} />
        {currentQueue.nextCursor ? <button type="button" className="tv-calls-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <SpinnerRing decorative /> : null}{loadingMore ? 'Carregando…' : 'Carregar mais chamados'}</button> : null}
      </section>

      <section className="tv-call-detail" aria-label="Detalhes do chamado">
        {selected ? <>
          <div className="tv-call-detail-topline"><span className={`tv-call-state is-${selected.status}`}>{STATUS_LABELS[selected.status]}</span><span className="tv-call-reference">#{selected.id.slice(0, 8).toUpperCase()}</span></div>
          <div className="tv-call-table-heading"><span className="tv-call-table-icon"><LuBell aria-hidden="true" /></span><div><small>Solicitação da mesa</small><h2>Mesa {selected.tableNumber}</h2></div></div>
          <p className="tv-call-detail-time"><LuClock3 aria-hidden="true" /><time dateTime={selected.createdAt} title={fullDateTime(selected.createdAt)}>Chamado {relativeTime(selected.createdAt)} · {formatCallTime(selected.createdAt)}</time></p>

          <div className="tv-call-timing-card">
            {selected.status === 'pending' ? <>
              <div className="tv-call-timing-icon"><LuClock3 aria-hidden="true" /></div>
              <div><small>Tempo na fila</small><strong>{formatElapsed(selected.createdAt, now)}</strong><span>O relógio para no primeiro aceite.</span></div>
              <span className="tv-call-timing-pulse" aria-hidden="true" />
            </> : selected.status === 'in_progress' ? <>
              <div className="tv-call-timing-icon is-service"><LuUserRound aria-hidden="true" /></div>
              <div><small>Tempo em atendimento</small><strong>{callServiceDuration(selected, now) ?? 'Não registrado'}</strong><span>Espera até o aceite: {callWaitDuration(selected) ?? 'Não registrada'}.</span></div>
            </> : <>
              <div className="tv-call-timing-icon is-done"><LuCheck aria-hidden="true" /></div>
              <div><small>Tempo até o primeiro aceite</small><strong>{callWaitDuration(selected) ?? 'Não registrado'}</strong><span>Tempo de atendimento: {callServiceDuration(selected) ?? 'Não registrado'}.</span></div>
            </>}
          </div>

          <div className="tv-call-assignment-card">
            <span className="tv-call-assignment-icon"><LuUserRound aria-hidden="true" /></span>
            <div><small>{selected.status === 'pending' ? 'Responsável' : 'Responsável atual'}</small><strong>{selectedOwner ?? (selected.status === 'pending' ? 'Aguardando alguém assumir' : 'Responsável indisponível')}</strong>{selected.firstClaimedAt ? <span>Assumido {relativeTime(selected.firstClaimedAt)}{selected.firstClaimedBy && memberNames.get(selected.firstClaimedBy) ? ` por ${memberNames.get(selected.firstClaimedBy)}` : ''}</span> : null}</div>
            {canTransfer && selected.status === 'in_progress' ? <button type="button" className="tv-call-transfer-trigger" disabled={busy || orderDraft} title={orderDraft ? 'Confirme ou limpe o pedido antes de transferir' : undefined} onClick={() => setTransferOpen(true)}><LuArrowRightLeft aria-hidden="true" />Transferir</button> : null}
          </div>

          {selected.status === 'in_progress' && isAssignee ? <OrderEntry
            key={selected.id}
            restaurantId={restaurantId}
            call={selected}
            menu={orderableMenu}
            initialAccount={initialAccount?.tableNumber === selected.tableNumber ? initialAccount : null}
            mobile={mobile}
            onDraftChange={setOrderDraft}
          /> : null}

          <div className="tv-call-action-area">
            {selected.status === 'pending' ? <>
              <button type="button" className="tv-call-button is-primary is-wide" disabled={busy} onClick={() => claim(selected)}>{busy ? <SpinnerRing decorative /> : <LuArrowDownLeft aria-hidden="true" />}{busy ? 'Assumindo chamado…' : 'Assumir chamado'}</button>
              <p className="tv-call-order-next-step">Depois de assumir, registre os itens e observações da mesa antes de concluir o atendimento.</p>
            </> : null}
            {selected.status === 'in_progress' && isAssignee ? <button type="button" className="tv-call-button is-primary is-wide" disabled={busy || orderDraft} onClick={() => resolve(selected)}>{busy ? <SpinnerRing decorative /> : <LuCheck aria-hidden="true" />}{busy ? 'Concluindo atendimento…' : orderDraft ? 'Confirme ou limpe o pedido antes de concluir' : 'Concluir atendimento'}</button> : null}
            {selected.status === 'in_progress' && !isAssignee ? <p className="tv-call-permission-note">{selected.assignedTo ? 'A conclusão fica disponível para quem assumiu este chamado.' : 'Peça a um administrador para atribuir este chamado a alguém da equipe.'}</p> : null}
            {selected.status === 'resolved' ? <p className="tv-call-completed-note"><LuCheckCheck aria-hidden="true" />Concluído {selected.resolvedAt ? relativeTime(selected.resolvedAt) : ''}{selectedActor ? ` por ${selectedActor}` : ''}</p> : null}
          </div>

          <div className="tv-call-history">
            <div className="tv-call-history-heading"><LuHistory aria-hidden="true" /><strong>Histórico do chamado</strong>{eventsLoading ? <SpinnerRing decorative /> : null}</div>
            {events.length ? <ol>{events.map((event) => <li key={event.id}>
              <span className={`tv-call-history-dot is-${event.eventType}`} aria-hidden="true" />
              <div><strong>{eventTitle(event, memberNames)}</strong><small>{eventActor(event, memberNames)}</small></div>
              <time dateTime={event.createdAt} title={fullDateTime(event.createdAt)}>{formatCallTime(event.createdAt)}</time>
            </li>)}</ol> : <p>{eventsLoading ? 'Carregando histórico…' : selected.status === 'pending' ? 'Aguardando a primeira assunção deste chamado.' : selected.firstClaimedAt ? 'Nenhuma mudança posterior foi registrada.' : 'Chamado histórico anterior ao registro de atribuição.'}</p>}
          </div>
        </> : <div className="tv-call-detail-empty"><span><LuBell aria-hidden="true" /></span><strong>Escolha um chamado</strong><small>O responsável e os tempos de atendimento aparecem aqui.</small></div>}
      </section>
    </div>

    <ServiceCallTransferDialog open={transferOpen} call={selected} team={team} busy={busy} mobile={mobile} onClose={() => setTransferOpen(false)} onTransfer={transfer} />
    <PanelConfirm open={discardOpen} onOpenChange={setDiscardOpen} icon={<LuTrash2 />} title="Descartar pedido em andamento?" description="Os itens e observações ainda não confirmados serão perdidos." confirmLabel="Descartar e continuar" destructive onConfirm={() => { const apply = pendingSelection.current; pendingSelection.current = null; apply?.() }} />
  </div>
}

function eventTitle(event: ServiceCallEventDTO, memberNames: Map<string, string>): string {
  if (event.eventType === 'claimed') return `Assumido por ${event.nextAssigneeId ? memberNames.get(event.nextAssigneeId) ?? 'Membro da equipe' : 'Membro da equipe'}`
  if (event.eventType === 'transferred') {
    const from = event.previousAssigneeId ? memberNames.get(event.previousAssigneeId) ?? 'Membro da equipe' : 'Equipe'
    const to = event.nextAssigneeId ? memberNames.get(event.nextAssigneeId) ?? 'Membro da equipe' : 'Equipe'
    return `Transferido de ${from} para ${to}`
  }
  return 'Atendimento concluído'
}

function eventActor(event: ServiceCallEventDTO, memberNames: Map<string, string>): string {
  const actor = event.actorId ? memberNames.get(event.actorId) : null
  return `${actor ?? 'Pessoa da equipe'} · ${relativeTime(event.createdAt)}`
}

function readServiceCallBroadcast(message: unknown): ServiceCallDTO | null {
  const root = message && typeof message === 'object' ? message as Record<string, unknown> : {}
  const payload = root.payload && typeof root.payload === 'object'
    ? root.payload as Record<string, unknown>
    : root
  return serviceCallFromRow(payload.record ?? payload.new)
}

function mergeQueues(
  current: QueueData,
  refreshed: Partial<QueueData>,
  latestCalls: ServiceCallDTO[],
  removedCallIds: string[] = [],
): QueueData {
  const latestById = new Map(latestCalls.map((call) => [call.id, call]))
  const removedIds = new Set(removedCallIds)
  const next = {} as QueueData

  for (const status of CALL_STATUSES) {
    const previous = current[status]
    const page = refreshed[status]
    const merged = new Map<string, ServiceCallDTO>()

    for (const call of previous.items) {
      const latest = latestById.get(call.id) ?? call
      if (!removedIds.has(call.id) && latest.status === status) merged.set(latest.id, latest)
    }
    for (const call of page?.items ?? []) {
      const latest = latestById.get(call.id) ?? call
      if (!removedIds.has(call.id) && latest.status === status) merged.set(latest.id, latest)
    }
    for (const call of latestCalls) {
      const isAlreadyLoaded = previous.items.some((item) => item.id === call.id)
      const isOnRefreshedPage = page?.items.some((item) => item.id === call.id) ?? false
      const canFitOnFirstPage = page !== undefined && page.items.length < CALL_PAGE_SIZE
      if (!removedIds.has(call.id) && call.status === status && (isAlreadyLoaded || isOnRefreshedPage || canFitOnFirstPage)) {
        merged.set(call.id, call)
      }
    }

    const items = sortCalls([...merged.values()], status)
    if (!page) {
      const nextCursor = previous.hasMore
        ? cursorForCall(items.at(-1), previous.nextCursor)
        : null
      next[status] = { items, hasMore: previous.hasMore, nextCursor }
      continue
    }

    const hadLoadedExtraPage = previous.items.length > CALL_PAGE_SIZE
    const keepPagination = previous.nextCursor !== null || hadLoadedExtraPage
    const hasMore = keepPagination ? previous.hasMore || page.hasMore : page.hasMore
    const previousBoundary = previous.nextCursor
      ?? (hadLoadedExtraPage ? cursorForCall(previous.items.at(-1), null) : null)
    const nextCursor = hasMore
      ? previousBoundary ?? page.nextCursor
      : null
    next[status] = { items, hasMore, nextCursor }
  }

  return next
}

function sortCalls(items: ServiceCallDTO[], status: ServiceCallStatus): ServiceCallDTO[] {
  return items.sort((left, right) => {
    const createdOrder = Date.parse(left.createdAt) - Date.parse(right.createdAt)
    const order = status === 'resolved' ? -createdOrder : createdOrder
    if (order !== 0) return order
    return status === 'resolved' ? right.id.localeCompare(left.id) : left.id.localeCompare(right.id)
  })
}

function cursorForCall(
  lastCall: ServiceCallDTO | undefined,
  fallback: ServiceCallPage['nextCursor'],
): ServiceCallPage['nextCursor'] {
  return lastCall ? { createdAt: lastCall.createdAt, id: lastCall.id } : fallback
}
