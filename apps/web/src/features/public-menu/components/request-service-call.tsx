'use client'

import { useState, useTransition } from 'react'
import { LuBell, LuCheck, LuLoaderCircle } from 'react-icons/lu'
import { requestServiceCallAction } from '@/server/actions/service-calls'

export function RequestServiceCall({ token }: { token: string }) {
  const [busy, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function request() {
    if (busy) return
    setMessage('')
    startTransition(async () => {
      try {
        const result = await requestServiceCallAction({ token })
        if (!result.ok) {
          setMessage(result.error)
          return
        }
        setSent(true)
        setMessage(`A equipe foi avisada sobre a mesa ${result.data.tableNumber}. Aguarde atendimento.`)
      } catch {
        setMessage('Falha de conexão. Verifique a internet e tente novamente.')
      }
    })
  }

  return (
    <div className="menu-call" role="group" aria-label="Solicitar atendimento">
      <button type="button" className="menu-call-button" onClick={request} disabled={busy} aria-describedby="menu-call-status">
        {busy ? <LuLoaderCircle aria-hidden="true" className="menu-call-spin" /> : sent ? <LuCheck aria-hidden="true" /> : <LuBell aria-hidden="true" />}
        {busy ? 'Chamando…' : sent ? 'Chamar novamente' : 'Chamar a equipe'}
      </button>
      <p id="menu-call-status" className="menu-call-status" aria-live="polite">{message}</p>
    </div>
  )
}
