'use client'

import { LuBanknote, LuCircleCheck, LuPrinter, LuReceiptText, LuSlidersHorizontal } from 'react-icons/lu'
import type { MemberRole } from '@/domain/invite'
import { formatTableAccountIdentity, type PaymentMethodDTO, type TableAccountDTO } from '@/domain/table-account'
import { formatCents } from '@/lib/money'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaymentEntry } from './payment-entry'
import { AccountCorrections } from './account-corrections'
import { AccountAudit } from './account-audit'
import { AccountConsumption } from './account-consumption'
import { AccountFinalization } from './account-finalization'
import { AccountPaymentHistory } from './account-payment-history'
import { PreAccount } from './pre-account'

export type CashTab = 'conta' | 'recebimentos' | 'finalizacao' | 'correcoes'
export type CashOperationState = 'idle' | 'busy' | 'uncertain'

export function CashAccountTabs({
  account,
  restaurantId,
  restaurantName,
  role,
  methods,
  allMethods,
  selectedTab,
  onTabChange,
  onUpdated,
  onOperationStateChange,
  operationState,
  navigationLocked,
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
  restaurantId: string
  restaurantName: string
  role: MemberRole
  methods: PaymentMethodDTO[]
  allMethods: PaymentMethodDTO[]
  selectedTab: CashTab
  onTabChange: (tab: CashTab) => void
  onUpdated: (account: TableAccountDTO) => void
  onOperationStateChange: (state: CashOperationState) => void
  operationState: CashOperationState
  navigationLocked: boolean
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
  return <>
    <section className="tv-cash-summary" aria-label={`Resumo ${formatTableAccountIdentity(account)}`}>
      <div className="tv-cash-summary-main">
        <div><span className={`tv-cash-status is-${account.status}`}>{account.status === 'open' ? 'Aberta' : account.status === 'settling' ? 'Em fechamento' : account.status === 'pending' ? 'Pendente' : 'Fechada'}</span><h2>{formatTableAccountIdentity(account)}</h2><small>Aberta em {new Date(account.openedAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</small></div>
        <div className="tv-cash-summary-right"><div className={`tv-cash-summary-due${account.balanceDueCents <= 0 ? ' is-settled' : ''}`}><span>SALDO PENDENTE</span><strong>{formatCents(account.balanceDueCents)}</strong></div><button type="button" className="tv-cash-print-icon" aria-label="Imprimir pré-conta" title="Imprimir pré-conta" onClick={() => window.print()}><LuPrinter aria-hidden="true" /></button></div>
      </div>
      <dl><div><dt>Total da conta</dt><dd>{formatCents(account.totalCents)}</dd></div><div><dt>Já recebido</dt><dd>{formatCents(account.paidCents)}</dd></div></dl>
    </section>

    {account.status === 'pending' ? <section className="tv-cash-pending-account" aria-label="Recebimento pendente">
      <div className="tv-cash-pending-banner"><strong>Recebimento pendente · {formatTableAccountIdentity(account)}</strong><span>A comanda foi liberada. Receba o saldo total ou em parcelas; cada parcela será registrada no caixa aberto no momento do recebimento.</span></div>
      {account.balanceDueCents > 0 ? <PaymentEntry
        key={`pending-payment-entry:${account.accountId}`}
        restaurantId={restaurantId}
        account={account}
        methods={methods}
        onUpdated={onUpdated}
        onOperationStateChange={onOperationStateChange}
      /> : <p className="tv-cash-readonly-note">Esta pendência não tem saldo restante.</p>}
      <AccountPaymentHistory account={account} />
    </section> : <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as CashTab)} className="tv-cash-tabs">
      <TabsList className="tv-cash-tabs-list" aria-label="Áreas da comanda">
        <TabsTrigger value="conta" aria-label="Conta" disabled={navigationLocked} className="tv-cash-tab"><LuReceiptText aria-hidden="true" /><span>Conta</span></TabsTrigger>
        <TabsTrigger value="recebimentos" aria-label="Recebimentos" disabled={navigationLocked} className="tv-cash-tab"><LuBanknote aria-hidden="true" /><span><span className="tv-cash-tab-wide">Recebimentos</span><span className="tv-cash-tab-short">Receber</span></span></TabsTrigger>
        <TabsTrigger value="finalizacao" aria-label="Finalização" disabled={navigationLocked} className="tv-cash-tab"><LuCircleCheck aria-hidden="true" /><span><span className="tv-cash-tab-wide">Finalização</span><span className="tv-cash-tab-short">Finalizar</span></span></TabsTrigger>
        <TabsTrigger value="correcoes" aria-label="Correções" disabled={navigationLocked} className="tv-cash-tab"><LuSlidersHorizontal aria-hidden="true" /><span><span className="tv-cash-tab-wide">Correções</span><span className="tv-cash-tab-short">Corrigir</span></span></TabsTrigger>
      </TabsList>

      <TabsContent value="conta" keepMounted className="tv-cash-tab-panel">
        <AccountConsumption account={account} />
        <p className="tv-cash-print-note">Apresentação para conferência da mesa e do caixa. Não substitui documento fiscal.</p>
      </TabsContent>

      <TabsContent value="recebimentos" keepMounted className="tv-cash-tab-panel">
        {operationState !== 'idle' || (account.status !== 'closed' && account.balanceDueCents > 0) ? <PaymentEntry
          key={`payment-entry:${account.accountId}`}
          restaurantId={restaurantId}
          account={account}
        methods={methods}
          onUpdated={onUpdated}
          onOperationStateChange={onOperationStateChange}
        /> : <p className="tv-cash-readonly-note">{account.status === 'closed' ? 'Comanda encerrada. Os recebimentos estão disponíveis no histórico abaixo.' : 'Saldo zerado. A comanda continua aberta para novos pedidos até o encerramento do consumo.'}</p>}
        <AccountPaymentHistory account={account} />
      </TabsContent>

      <TabsContent value="finalizacao" keepMounted className="tv-cash-tab-panel">
        <AccountFinalization
          account={account}
          role={role}
          busy={busy}
          showTipDecision={showTipDecision}
          onShowTipDecisionChange={onShowTipDecisionChange}
          onDecideTip={onDecideTip}
          reopenOpen={reopenOpen}
          onReopenOpenChange={onReopenOpenChange}
          reopenReason={reopenReason}
          onReopenReasonChange={onReopenReasonChange}
          onReopen={onReopen}
        />
      </TabsContent>

      <TabsContent value="correcoes" keepMounted className="tv-cash-tab-panel">
        <AccountCorrections
          key={`account-corrections:${account.accountId}`}
          restaurantId={restaurantId}
          account={account}
          methods={allMethods}
          role={role}
          onUpdated={onUpdated}
          onOperationStateChange={onOperationStateChange}
        />
        <AccountAudit account={account} />
      </TabsContent>
    </Tabs>}

    <div className="tv-cash-print-only" aria-hidden="true"><PreAccount restaurantName={restaurantName} account={account} /></div>
  </>
}
