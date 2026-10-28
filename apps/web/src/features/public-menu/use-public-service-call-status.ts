'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import type { PublicServiceCallStatusDTO } from '@/domain/service-call'
import { publicServiceCallStatusSchema } from '@/domain/service-call'
import { getPublicServiceCallStatusAction } from '@/server/actions/service-calls'
import { openPublicServiceCallChannel } from './realtime'

const statusRank = { pending: 0, in_progress: 1, resolved: 2 } as const

export function usePublicServiceCallStatus(token: string) {
  const [call, setCall] = useState<PublicServiceCallStatusDTO>(null)
  const [loading, setLoading] = useState(true)
  const callRef = useRef<PublicServiceCallStatusDTO>(null)
  const revisionRef = useRef(0)
  const notifiedRef = useRef(new Set<string>())

  const notifyAccepted = useCallback((callId: string) => {
    const storageKey = `tavvi:service-call-accepted:${token}:${callId}`
    if (notifiedRef.current.has(callId)) return
    try {
      if (window.sessionStorage.getItem(storageKey)) return
      window.sessionStorage.setItem(storageKey, '1')
    } catch { /* The in-memory set still deduplicates this mount. */ }
    notifiedRef.current.add(callId)
    toast.add({
      type: 'success',
      title: 'Seu chamado foi aceito',
      description: 'A equipe já está atendendo você.',
      priority: 'high',
    })
  }, [token])

  const applyStatus = useCallback((next: PublicServiceCallStatusDTO, notify: boolean) => {
    const previous = callRef.current
    if (next && previous?.callId === next.callId
      && statusRank[next.status] < statusRank[previous.status]) return
    callRef.current = next
    setCall(next)
    if (notify && next?.status === 'in_progress') notifyAccepted(next.callId)
  }, [notifyAccepted])

  const sync = useCallback(async (notify = true) => {
    const revision = ++revisionRef.current
    let result: Awaited<ReturnType<typeof getPublicServiceCallStatusAction>>
    try {
      result = await getPublicServiceCallStatusAction({ token })
    } catch {
      if (revision === revisionRef.current) setLoading(false)
      return
    }
    if (revision !== revisionRef.current) return
    setLoading(false)
    if (!result.ok) return
    const parsed = publicServiceCallStatusSchema.safeParse(result.data)
    if (parsed.success) applyStatus(parsed.data, notify)
  }, [applyStatus, token])

  const acceptRequestResult = useCallback((next: PublicServiceCallStatusDTO) => {
    revisionRef.current++
    applyStatus(next, true)
    setLoading(false)
  }, [applyStatus])

  useEffect(() => {
    let disposed = false
    let closeChannel: () => void = () => undefined
    callRef.current = null
    setCall(null)
    setLoading(true)
    void sync(true)
    void openPublicServiceCallChannel(token, {
      onMessage(message) {
        const outer = message && typeof message === 'object' ? message as Record<string, unknown> : null
        const payload = outer?.payload && typeof outer.payload === 'object'
          ? outer.payload as Record<string, unknown>
          : outer
        const parsed = publicServiceCallStatusSchema.safeParse({ callId: payload?.callId, status: payload?.status })
        if (!parsed.success || !parsed.data) return
        if (callRef.current?.callId === parsed.data.callId) {
          applyStatus(parsed.data, true)
        } else {
          void sync(true)
        }
      },
      onSubscribed: () => { void sync(true) },
      onResync: () => { void sync(true) },
    }).then((close) => {
      if (disposed) close()
      else closeChannel = close
    }).catch((error) => {
      console.warn('[realtime] canal público indisponível', error instanceof Error ? error.message : error)
    })

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void sync(true)
    }
    document.addEventListener('visibilitychange', refreshOnReturn)
    window.addEventListener('focus', refreshOnReturn)
    return () => {
      disposed = true
      closeChannel()
      document.removeEventListener('visibilitychange', refreshOnReturn)
      window.removeEventListener('focus', refreshOnReturn)
    }
  }, [applyStatus, sync, token])

  return { call, loading, acceptRequestResult, refresh: sync }
}
