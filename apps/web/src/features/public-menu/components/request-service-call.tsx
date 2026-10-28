'use client'

import { useTransition } from 'react'
import { LuBell, LuCheck, LuLoaderCircle } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import { requestServiceCallAction } from '@/server/actions/service-calls'
import { usePublicServiceCallStatus } from '../use-public-service-call-status'

export function RequestServiceCall({ token }: { token: string }) {
  const [busy, startTransition] = useTransition()
  const { call, loading, acceptRequestResult } = usePublicServiceCallStatus(token)
  const active = call?.status === 'pending' || call?.status === 'in_progress'

  function request() {
    if (busy || loading || active) return
    startTransition(async () => {
      try {
        const result = await requestServiceCallAction({ token })
        if (!result.ok) {
          toast.add({
            type: 'error',
            title: 'Chamado não enviado',
            description: result.error,
            priority: 'high',
          })
          return
        }
        acceptRequestResult({ callId: result.data.callId, status: result.data.status })
        if (result.data.status === 'pending') toast.add({
          type: result.data.created ? 'success' : 'info',
          title: result.data.created ? 'Chamado enviado' : 'Chamado já está na fila',
          description: `A equipe foi avisada sobre a mesa ${result.data.tableNumber}. Aguarde ser atendido.`,
        })
      } catch {
        toast.add({
          type: 'error',
          title: 'Falha de conexão',
          description: 'Confira sua internet e tente chamar a equipe novamente.',
          priority: 'high',
        })
      }
    })
  }

  const buttonLabel = busy ? 'Chamando…'
    : loading ? 'Verificando chamado…'
      : call?.status === 'pending' ? 'Aguarde ser atendido'
        : call?.status === 'in_progress' ? 'Equipe está atendendo'
          : 'Chamar equipe'

  return (
    <footer className="menu-call" role="group" aria-label="Solicitar atendimento">
      <div className="menu-call-inner">
        <button type="button" className="menu-call-button" onClick={request} disabled={busy || loading || active}>
          {busy || loading || call?.status === 'pending' ? <LuLoaderCircle aria-hidden="true" className="menu-call-spin" /> : call?.status === 'in_progress' ? <LuCheck aria-hidden="true" /> : <LuBell aria-hidden="true" />}
          {buttonLabel}
        </button>
      </div>
    </footer>
  )
}
