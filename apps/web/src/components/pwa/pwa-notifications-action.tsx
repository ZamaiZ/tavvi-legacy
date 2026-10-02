'use client'

import { useId, useState, type MouseEvent, type ReactNode } from 'react'
import { LuBell, LuBellOff, LuBellRing } from 'react-icons/lu'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { usePush, type PushResult } from './push-provider'

type Action = {
  key: string
  icon: ReactNode
  label: string
  hint?: string
  run: (event: MouseEvent<HTMLButtonElement>) => void
  // Abre e fecha a explicação, em vez de agir.
  expands?: boolean
}

// O texto enquanto a ação roda: o spinner sozinho não diz o que está acontecendo.
const PENDING_LABEL: Record<string, string> = {
  on: 'Ativando…',
  off: 'Desativando…',
  test: 'Enviando teste…',
}

// "Notificações": logo abaixo de "Instalar app" nas telas de conta (Ajustes
// do painel, Conta do console, popover do desktop). A permissão do
// navegador só é pedida num toque em "Ativar notificações", nunca sozinha.
export function PwaNotificationsAction({ variant, className }: { variant: 'row' | 'popover'; className?: string }) {
  const { availability, subscribed, pending, enable, disable, sendTest } = usePush()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = useId()
  const [runningKey, setRunningKey] = useState<string | null>(null)
  if (availability === 'unsupported') return null

  const help =
    availability === 'needs-install'
      ? 'Instale o app pela linha “Instalar app” e ative as notificações dentro dele.'
      : availability === 'denied'
        ? 'As notificações deste app estão bloqueadas. Libere nas configurações do navegador e volte aqui.'
        : null

  // Os botões trocam depois de ativar ou desativar. Dentro do popover ou do
  // sheet, o foco volta ao tema atual, como no "Instalar app", para o Tab
  // continuar preso no diálogo.
  function settle(event: MouseEvent<HTMLButtonElement>, task: Promise<PushResult>, success: string, refocus: boolean) {
    const dialog = event.currentTarget.closest('[role="dialog"]')
    void task.then((result) => {
      if (result.ok) toast.add({ title: success, type: 'success' })
      else if (result.error) toast.add({ title: result.error, type: 'error' })
      if (refocus) dialog?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    })
  }

  // enable() é chamado direto no clique: o pedido de permissão precisa sair
  // do gesto.
  const actions: Action[] = help
    ? [
        {
          key: 'help',
          icon: <LuBellOff aria-hidden="true" />,
          label: 'Notificações',
          hint: availability === 'needs-install' ? 'Disponíveis no app instalado' : 'Bloqueadas no navegador',
          run: () => setHelpOpen((open) => !open),
          expands: true,
        },
      ]
    : subscribed
      ? [
          {
            key: 'test',
            icon: <LuBellRing aria-hidden="true" />,
            label: 'Enviar notificação de teste',
            hint: 'Ativas neste aparelho',
            run: (event) => settle(event, sendTest(), 'Notificação enviada', false),
          },
          {
            key: 'off',
            icon: <LuBellOff aria-hidden="true" />,
            label: 'Desativar notificações',
            run: (event) => settle(event, disable(), 'Notificações desativadas', true),
          },
        ]
      : [
          {
            key: 'on',
            icon: <LuBell aria-hidden="true" />,
            label: 'Ativar notificações',
            hint: 'Avisos mesmo com o app fechado',
            run: (event) => settle(event, enable(), 'Notificações ativadas', true),
          },
        ]

  function running(action: Action) {
    return pending && runningKey === action.key && !action.expands
  }

  function buttonProps(action: Action) {
    return {
      type: 'button' as const,
      disabled: pending && !action.expands,
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        setRunningKey(action.key)
        action.run(event)
      },
      'aria-expanded': action.expands ? helpOpen : undefined,
      'aria-controls': action.expands ? helpId : undefined,
    }
  }

  if (variant === 'popover') {
    return (
      <div className="tv-account-section">
        {actions.map((action) => (
          <button key={action.key} {...buttonProps(action)} className="tv-account-action">
            {running(action) ? <SpinnerRing decorative /> : action.icon}
            <span>{running(action) ? PENDING_LABEL[action.key] ?? action.label : action.label}</span>
          </button>
        ))}
        {help ? <p id={helpId} className="tv-account-note" hidden={!helpOpen}>{help}</p> : null}
      </div>
    )
  }

  return (
    <>
      <div className={className ? `tv-group ${className}` : 'tv-group'}>
        {actions.map((action) => (
          <button key={action.key} {...buttonProps(action)} className="tv-mlink">
            <span className="tv-mlink-icon" aria-hidden="true">{running(action) ? <SpinnerRing decorative /> : action.icon}</span>
            <span className="tv-mlink-copy">
              <span>{running(action) ? PENDING_LABEL[action.key] ?? action.label : action.label}</span>
              {action.hint ? <small>{action.hint}</small> : null}
            </span>
          </button>
        ))}
      </div>
      {help ? <p id={helpId} className="tv-group-note" hidden={!helpOpen}>{help}</p> : null}
    </>
  )
}
