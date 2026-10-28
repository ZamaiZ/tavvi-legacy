'use client'

import type { MemberRole } from '@/domain/invite'
import type { TableAccountDTO } from '@/domain/table-account'
import { LuLock } from 'react-icons/lu'
import { formatCents } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'

export function AccountFinalization({
  account,
  role,
  busy,
  showTipDecision,
  onShowTipDecisionChange,
  onDecideTip,
  reopenOpen,
  onReopenOpenChange,
  reopenReason,
  onReopenReasonChange,
  onReopen,
}: {
  account: TableAccountDTO
  role: MemberRole
  busy: boolean
  showTipDecision: boolean
  onShowTipDecisionChange: (show: boolean) => void
  onDecideTip: (accepted: boolean) => void
  reopenOpen: boolean
  onReopenOpenChange: (open: boolean) => void
  reopenReason: string
  onReopenReasonChange: (reason: string) => void
  onReopen: () => void
}) {
  const admin = role === 'admin'
  return <section className="tv-cash-finalization" aria-labelledby="tv-cash-finalization-title">
    <header className="tv-cash-panel-heading">
      <div><span>ENCERRAMENTO</span><h3 id="tv-cash-finalization-title">Finalização da comanda</h3><p>Finalize o consumo e confira o estado de recebimento.</p></div>
    </header>

    {account.status === 'open' ? <div className={`tv-cash-finalization-card${showTipDecision ? ' is-confirming' : ''}`}>
      {!showTipDecision ? <>
        <span className="tv-cash-finalization-icon" aria-hidden="true"><LuLock /></span>
        <div><strong>Quando a mesa terminar o consumo</strong><p>Iniciar o fechamento define a gorjeta e bloqueia novos pedidos. O saldo pode ser recebido em seguida.</p></div>
        <button type="button" className="tv-cash-start-close" onClick={() => onShowTipDecisionChange(true)}>Encerrar consumo</button>
      </> : <>
        <div><strong>Confirmar encerramento do consumo</strong><p>Depois desta decisão, novos pedidos ficam bloqueados. O caixa ainda pode registrar os pagamentos que faltarem. A gorjeta é única para a comanda e pode ser recusada.</p></div>
        {account.tipMode === 'disabled' || account.subtotalCents <= 0 ? <button type="button" disabled={busy} onClick={() => onDecideTip(false)}>{busy ? <SpinnerRing decorative /> : null}Fechar comanda sem gorjeta</button> : <div className="tv-cash-tip-options">
          <button type="button" disabled={busy} onClick={() => onDecideTip(false)}>Recusar gorjeta e fechar · {formatCents(0)}</button>
          <button type="button" disabled={busy} onClick={() => onDecideTip(true)}>Aceitar gorjeta e fechar · {formatCents(estimateTip(account))}</button>
        </div>}
        <button type="button" className="tv-cash-secondary-button" disabled={busy} onClick={() => onShowTipDecisionChange(false)}>Voltar</button>
      </>}
    </div> : null}

    {account.status === 'settling' ? <div className="tv-cash-settling-note"><strong>Consumo encerrado</strong><span>Novos pedidos estão bloqueados. Receba o saldo pendente para concluir a comanda.</span></div> : null}
    {account.status === 'closed' ? <div className="tv-cash-finalization-card is-closed"><strong>Comanda encerrada</strong><p>O consumo foi finalizado e não há saldo pendente.</p></div> : null}

    {account.status !== 'closed' && account.balanceDueCents === 0 ? <p className="tv-cash-paid-note">Saldo zerado. A comanda continua aberta para novos pedidos até o encerramento do consumo.</p> : null}

    {admin && account.status !== 'open' ? <section className="tv-cash-reopen">
      {!reopenOpen ? <button type="button" className="tv-cash-secondary-button" onClick={() => onReopenOpenChange(true)}>Reabrir comanda</button> : <div>
        <label>Motivo da reabertura<input value={reopenReason} maxLength={500} onChange={(event) => onReopenReasonChange(event.target.value)} placeholder="Ex.: fechamento iniciado por engano" /></label>
        <div><button type="button" disabled={busy || reopenReason.trim().length < 3} onClick={onReopen}>{busy ? <SpinnerRing decorative /> : null}Confirmar reabertura</button><button type="button" className="tv-cash-secondary-button" disabled={busy} onClick={() => onReopenOpenChange(false)}>Voltar</button></div>
      </div>}
    </section> : null}
  </section>
}

function estimateTip(account: TableAccountDTO): number {
  if (account.subtotalCents <= 0) return 0
  if (account.tipMode === 'percentage') return Math.round(account.subtotalCents * (account.tipPercentBps ?? 0) / 10000)
  if (account.tipMode === 'fixed') return account.tipFixedCents ?? 0
  return 0
}
