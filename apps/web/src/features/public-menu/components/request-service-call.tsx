'use client'

import { useState, useTransition } from 'react'
import { LuBell, LuCheck, LuLoaderCircle } from 'react-icons/lu'
import { toast } from '@/components/ui/toast'
import { requestServiceCallAction } from '@/server/actions/service-calls'

export function RequestServiceCall({ token }: { token: string }) {
  const [busy, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  function request() {
    if (busy) return
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
        setSent(true)
        toast.add({
          type: result.data.created ? 'success' : 'info',
          title: result.data.created
            ? 'Chamado enviado'
            : result.data.status === 'in_progress' ? 'A equipe já está atendendo' : 'Chamado já está na fila',
          description: result.data.created
            ? `A equipe foi avisada sobre a mesa ${result.data.tableNumber}. Aguarde por aqui.`
            : result.data.status === 'in_progress'
              ? `A equipe já assumiu o atendimento da mesa ${result.data.tableNumber}.`
              : `A equipe já foi avisada sobre a mesa ${result.data.tableNumber}. Seu chamado continua na fila.`,
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

  return (
    <footer className="menu-call" role="group" aria-label="Solicitar atendimento">
      <div className="menu-call-inner">
        <button type="button" className="menu-call-button" onClick={request} disabled={busy}>
          {busy ? <LuLoaderCircle aria-hidden="true" className="menu-call-spin" /> : sent ? <LuCheck aria-hidden="true" /> : <LuBell aria-hidden="true" />}
          {busy ? 'Chamando…' : sent ? 'Chamar novamente' : 'Chamar a equipe'}
        </button>
      </div>
    </footer>
  )
}
