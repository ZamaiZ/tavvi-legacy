'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuBell, LuBellOff, LuCheck, LuCheckCheck, LuClock3, LuVolume2 } from 'react-icons/lu'
import { PageHeader } from '@/components/shell/page-header'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { ServiceCallDTO, ServiceCallPage } from '@/domain/service-call'
import { fullDateTime, relativeTime } from '@/lib/relative-time'
import { listServiceCallsAction, resolveServiceCallAction } from '@/server/actions/service-calls'
import { CallList } from './call-list'
import { disableServiceCallSound, enableServiceCallSoundFromGesture, isServiceCallSoundEnabled } from '../call-sound'
import { useServiceCallsRealtime } from '../use-service-calls-realtime'

type Filter = 'pending' | 'resolved'

export function CallsScreen({ restaurantId, initialPending, initialResolved, focusedCall }: {
  restaurantId: string
  initialPending: ServiceCallPage
  initialResolved: ServiceCallPage
  focusedCall: ServiceCallDTO | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(initialPending.items)
  const [resolved, setResolved] = useState(initialResolved.items)
  const [pendingCursor, setPendingCursor] = useState(initialPending.nextCursor)
  const [resolvedCursor, setResolvedCursor] = useState(initialResolved.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<Filter>(focusedCall?.status ?? 'pending')
  const [selectedId, setSelectedId] = useState<string | null>(focusedCall?.id ?? initialPending.items[0]?.id ?? null)
  const [busy, startTransition] = useTransition()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { setSoundEnabled(isServiceCallSoundEnabled()) }, [])

  const selected = useMemo(() => {
    return [...pending, ...resolved].find((call) => call.id === selectedId) ?? (focusedCall?.id === selectedId ? focusedCall : null)
  }, [focusedCall, pending, resolved, selectedId])

  const refresh = useCallback(async () => {
    try {
      const [pendingResult, resolvedResult] = await Promise.all([
        listServiceCallsAction({ restaurantId, status: 'pending' }),
        listServiceCallsAction({ restaurantId, status: 'resolved' }),
      ])
      if (pendingResult.ok) { setPending(pendingResult.data.items); setPendingCursor(pendingResult.data.nextCursor) }
      else console.error('[chamados] atualização da fila', pendingResult.error)
      if (resolvedResult.ok) { setResolved(resolvedResult.data.items); setResolvedCursor(resolvedResult.data.nextCursor) }
      else console.error('[chamados] atualização do histórico', resolvedResult.error)
    } catch (error) {
      console.error('[chamados] atualização indisponível', error)
    } finally { setRefreshing(false) }
  }, [restaurantId])

  const onRealtime = useCallback(() => { setRefreshing(true); void refresh() }, [refresh])
  useServiceCallsRealtime(restaurantId, onRealtime)

  useEffect(() => {
    const current = filter === 'pending' ? pending : resolved
    const existsInEitherList = [...pending, ...resolved].some((call) => call.id === selectedId)
    if (!selectedId || (!current.some((call) => call.id === selectedId) && existsInEitherList)) {
      const focusedInCurrent = focusedCall?.status === filter && current.some((call) => call.id === focusedCall.id)
      setSelectedId(focusedInCurrent ? focusedCall?.id ?? null : current[0]?.id ?? null)
    }
  }, [filter, pending, resolved, focusedCall, selectedId])

  function resolve(call: ServiceCallDTO) {
    if (busy || call.status === 'resolved') return
    startTransition(async () => {
      try {
        const result = await resolveServiceCallAction({ restaurantId, callId: call.id })
        if (!result.ok) { toast.add({ title: result.error, type: 'error' }); return }
        setPending((current) => current.filter((item) => item.id !== call.id))
        setResolved((current) => [result.data, ...current.filter((item) => item.id !== call.id)])
        setFilter('resolved')
        setSelectedId(call.id)
        router.refresh()
      } catch { toast.add({ title: 'Falha de conexão. O chamado continua pendente.', type: 'error' }) }
    })
  }

  async function loadMore() {
    const cursor = filter === 'pending' ? pendingCursor : resolvedCursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await listServiceCallsAction({ restaurantId, status: filter, cursor })
      if (!result.ok) { toast.add({ title: result.error, type: 'error' }); return }
      if (filter === 'pending') {
        setPending((current) => [...current, ...result.data.items.filter((item) => !current.some((entry) => entry.id === item.id))])
        setPendingCursor(result.data.nextCursor)
      } else {
        setResolved((current) => [...current, ...result.data.items.filter((item) => !current.some((entry) => entry.id === item.id))])
        setResolvedCursor(result.data.nextCursor)
      }
    } catch { toast.add({ title: 'Falha de conexão ao carregar os chamados.', type: 'error' }) }
    finally { setLoadingMore(false) }
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

  const list = filter === 'pending' ? pending : resolved
  return <div className="tv-calls-page">
    <MobileNavBar backHref={`/restaurantes/${restaurantId}/servico`} backLabel="Serviço" />
    <PageHeader eyebrow="Atendimento" title="Chamados" description="Acompanhe as solicitações de atendimento feitas pelo cardápio." />
    <div className="tv-calls-toolbar">
      <div className="tv-calls-tabs" role="tablist" aria-label="Fila de chamados">
        <button type="button" role="tab" aria-selected={filter === 'pending'} onClick={() => setFilter('pending')}><LuBell aria-hidden="true" />Pendentes<span>{pending.length}</span></button>
        <button type="button" role="tab" aria-selected={filter === 'resolved'} onClick={() => setFilter('resolved')}><LuCheckCheck aria-hidden="true" />Concluídos<span>{resolved.length}</span></button>
      </div>
      <button type="button" className={`tv-calls-sound ${soundEnabled ? 'is-on' : ''}`} onClick={() => void toggleSound()}>{soundEnabled ? <LuVolume2 aria-hidden="true" /> : <LuBellOff aria-hidden="true" />}{soundEnabled ? 'Som ativado neste aparelho' : 'Ativar som neste aparelho'}</button>
    </div>
    <div className="tv-calls-layout">
      <section className="tv-calls-list-panel" aria-label={filter === 'pending' ? 'Fila pendente' : 'Histórico de chamados'}>
        <div className="tv-calls-list-head"><strong>{filter === 'pending' ? 'Aguardando atendimento' : 'Atendidos'}</strong>{refreshing ? <span><SpinnerRing decorative /> Atualizando</span> : null}</div>
        <CallList items={list} selectedId={selectedId} onSelect={(call) => setSelectedId(call.id)} status={filter} />
        {(filter === 'pending' ? pendingCursor : resolvedCursor) ? <button type="button" className="tv-calls-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <SpinnerRing decorative /> : null}{loadingMore ? 'Carregando…' : 'Carregar mais'}</button> : null}
      </section>
      <section className="tv-call-detail" aria-live="polite" aria-label="Detalhes do chamado">
        {selected ? <>
          <div className="tv-call-detail-icon" aria-hidden="true">{selected.status === 'resolved' ? <LuCheckCheck /> : <LuBell />}</div>
          <p className="tv-call-status">{selected.status === 'resolved' ? 'Atendido' : 'Pendente'}</p>
          <h2>Mesa {selected.tableNumber}</h2>
          <p className="tv-call-detail-time"><LuClock3 aria-hidden="true" /><time dateTime={selected.createdAt} title={fullDateTime(selected.createdAt)}>Chamado {relativeTime(selected.createdAt)} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.createdAt))}</time></p>
          {selected.resolvedAt ? <p className="tv-call-resolved-time">Atendido {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.resolvedAt))}</p> : null}
          {selected.status === 'pending' ? <button type="button" className="tv-call-resolve" disabled={busy} onClick={() => resolve(selected)}>{busy ? <SpinnerRing decorative /> : <LuCheck aria-hidden="true" />}{busy ? 'Salvando…' : 'Marcar atendido'}</button> : null}
        </> : <div className="tv-call-detail-empty"><LuBell aria-hidden="true" /><strong>Selecione um chamado</strong><span>Os detalhes da mesa aparecem aqui.</span></div>}
      </section>
    </div>
  </div>
}
