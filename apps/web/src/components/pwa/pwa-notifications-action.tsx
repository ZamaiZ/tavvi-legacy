'use client'

import { useId, useState, type MouseEvent, type ReactNode } from 'react'
import { LuBell, LuBellOff, LuChevronRight, LuSmartphone } from 'react-icons/lu'
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
}

// Push deste aparelho: no desktop, como interruptor na página Configurações
// (`group`); no celular, como linha das subtelas de conta e notificações
// (`row`). A permissão do navegador só é pedida
// num toque, nunca sozinha. Sem suporte, não renderiza nada — nem o rótulo.
export function PwaNotificationsAction({ variant, className, label }: { variant: 'row' | 'group'; className?: string; label?: string }) {
  const { availability, subscribed, pending, enable, disable } = usePush()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = useId()
  const hintId = useId()
  const [runningKey, setRunningKey] = useState<string | null>(null)
  if (availability === 'unsupported') return null

  const help =
    availability === 'needs-install'
      ? 'Instale o app pela linha “Instalar app” e ative as notificações dentro dele.'
      : availability === 'denied'
        ? 'As notificações deste app estão bloqueadas. Libere nas configurações do navegador e volte aqui.'
        : null
  const helpHint = availability === 'needs-install' ? 'Disponíveis no app instalado' : 'Bloqueadas no navegador'

  // Na linha, os botões trocam depois de ativar ou desativar; dentro do
  // sheet, o foco volta ao tema atual, como no "Instalar app", para o Tab
  // continuar preso no diálogo. O interruptor não troca: o foco fica nele.
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
          hint: helpHint,
          run: () => setHelpOpen((open) => !open),
          expands: true,
        },
      ]
    : subscribed
      ? [
          // O teste mora na central ("Enviar notificação de teste") e passa
          // pelo caminho inteiro, não só pelo push deste aparelho.
          {
            key: 'off',
            icon: <LuBellOff aria-hidden="true" />,
            label: 'Desativar notificações',
            hint: 'Ativas neste aparelho',
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

  // Primeira linha do grupo "Neste aparelho" da central (o teste vem logo
  // abaixo, montado pela NotificationList). Bloqueado ou só no app
  // instalado, o interruptor sai e a linha abre a explicação. Ocupado, o
  // interruptor segue focável (aria-disabled): desabilitado, perderia o foco
  // e o Tab escaparia do popover.
  if (variant === 'group') {
    const tile = <span className="tv-notif-device-tile" aria-hidden="true"><LuSmartphone /></span>
    return (
      <>
        {help ? (
          <>
            <button type="button" className="tv-notif-device-row" aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen((open) => !open)}>
              {tile}
              <span className="tv-notif-device-copy"><strong>Neste aparelho</strong><small>{helpHint}</small></span>
              <LuChevronRight className="tv-notif-chevron" aria-hidden="true" />
            </button>
            <p id={helpId} className="tv-account-note" hidden={!helpOpen}>{help}</p>
          </>
        ) : (
          <div className="tv-notif-device-row">
            {tile}
            <span className="tv-notif-device-copy">
              <strong>Neste aparelho</strong>
              <small id={hintId}>{subscribed ? 'Avisos mesmo com o app fechado' : 'Desativadas neste aparelho'}</small>
            </span>
            <button
              type="button"
              role="switch"
              className="tv-notif-switch"
              aria-checked={subscribed}
              aria-label="Ativar notificações"
              aria-describedby={hintId}
              aria-disabled={pending || undefined}
              aria-busy={pending || undefined}
              onClick={(event) => {
                if (pending) return
                if (subscribed) settle(event, disable(), 'Notificações desativadas', false)
                else settle(event, enable(), 'Notificações ativadas', false)
              }}
            >
              <span className="tv-notif-switch-knob" />
            </button>
          </div>
        )}
        <span className="tv-notif-hairline" aria-hidden="true" />
      </>
    )
  }

  return (
    <>
      {label ? <h2 className="tv-group-label">{label}</h2> : null}
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
