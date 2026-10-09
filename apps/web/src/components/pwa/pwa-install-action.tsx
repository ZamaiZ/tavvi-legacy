'use client'

import { useId, useState, type MouseEvent } from 'react'
import { LuDownload } from 'react-icons/lu'
import { usePwa } from './pwa-provider'

type Help = 'ios' | 'safari-mac'

// iOS e Safari do Mac não têm diálogo de instalação: a linha mostra o
// caminho no menu do navegador. Sem "No Safari": no iOS, Chrome e Edge
// também adicionam pelo Compartilhar.
function HelpText({ help }: { help: Help }) {
  return help === 'ios'
    ? <>Toque em Compartilhar e escolha <strong>Adicionar à Tela de Início</strong>.</>
    : <>No menu Arquivo, escolha <strong>Adicionar ao Dock</strong>.</>
}

// "Instalar app": linha agrupada no celular (Conta do painel, Conta do
// console) e no grupo de "Notificações" do popover de conta no desktop. Só
// aparece quando dá para instalar e o app não está aberto instalado. Nada
// acontece sem um toque.
export function PwaInstallAction({ variant, className }: { variant: 'row' | 'popover'; className?: string }) {
  const { installAvailability, install } = usePwa()
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = useId()
  if (installAvailability === 'unavailable') return null

  const help: Help | null = installAvailability === 'prompt' ? null : installAvailability

  // Depois da escolha no diálogo nativo, o convite acaba e esta linha some.
  // Dentro do popover ou do sheet de conta, o foco volta ao tema atual (o
  // mesmo alvo da abertura), para o Tab continuar preso no diálogo.
  function installAndKeepFocus(event: MouseEvent<HTMLButtonElement>) {
    const dialog = event.currentTarget.closest('[role="dialog"]')
    void install().then(() => {
      dialog?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus()
    })
  }

  const buttonProps = {
    type: 'button' as const,
    onClick: help ? () => setHelpOpen((open) => !open) : installAndKeepFocus,
    'aria-expanded': help ? helpOpen : undefined,
    'aria-controls': help ? helpId : undefined,
  }

  // No popover, entra no grupo de "Notificações", abaixo dela e separada por
  // hairline — que só existe quando a linha existe.
  if (variant === 'popover') {
    return (
      <>
        <span className="tv-account-hairline is-inset" aria-hidden="true" />
        <button {...buttonProps} className="tv-account-row">
          <span className="tv-account-tile is-neutral" aria-hidden="true"><LuDownload /></span>
          <span className="tv-account-row-label">Instalar app</span>
        </button>
        {help ? <p id={helpId} className="tv-account-note" hidden={!helpOpen}><HelpText help={help} /></p> : null}
      </>
    )
  }

  return (
    <>
      <div className={className ? `tv-group ${className}` : 'tv-group'}>
        <button {...buttonProps} className="tv-mlink">
          <span className="tv-mlink-icon" aria-hidden="true"><LuDownload /></span>
          <span className="tv-mlink-copy"><span>Instalar app</span><small>Abre em tela cheia, sem o navegador</small></span>
        </button>
      </div>
      {help ? <p id={helpId} className="tv-group-note" hidden={!helpOpen}><HelpText help={help} /></p> : null}
    </>
  )
}
