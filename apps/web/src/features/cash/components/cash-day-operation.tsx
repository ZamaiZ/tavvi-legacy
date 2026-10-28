'use client'

import { useState, type ReactNode } from 'react'
import { LuCircleCheck, LuLockKeyhole } from 'react-icons/lu'
import type { FinanceDashboardDTO } from '@/domain/finance'
import type { MemberRole } from '@/domain/invite'
import { formatCents } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { MobileSheet, MobileSheetNav, useSheetBusy } from '@/components/shell/mobile-sheet'
import { ItemPanel, useItemPanelGuard } from '@/features/menu-editor/components/item-panel'
import { useIsMobile } from '@/hooks/use-mobile'
import { CashDayClosing } from '@/features/finance/components/cash-day-closing'
import { CashDayOpening } from '@/features/finance/components/cash-day-opening'

export function CashDayOperation({ restaurantId, role, dashboard, onUpdated }: {
  restaurantId: string
  role: MemberRole
  dashboard: FinanceDashboardDTO
  onUpdated: (dashboard: FinanceDashboardDTO) => void
}) {
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const activeDay = dashboard.activeDay

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    setOpen(next)
  }

  return <>
    <section className="tv-cash-day-operation" aria-label="Resumo do caixa">
      <div className="tv-cash-day-operation-heading">
        <span className={activeDay ? 'is-open' : 'is-closed'}>
          {activeDay ? <LuCircleCheck aria-hidden="true" /> : <LuLockKeyhole aria-hidden="true" />}
        </span>
        <div>
          <strong>{activeDay ? 'Caixa aberto' : 'Caixa fechado'}</strong>
          <small>{activeDay ? 'Resumo do período em andamento' : 'Não há período de caixa aberto'}</small>
        </div>
      </div>
      {activeDay ? <div className="tv-cash-day-operation-values">
        <div className="is-primary"><small>Dinheiro esperado</small><strong>{formatCents(dashboard.totals.expectedCashCents)}</strong></div>
        <div><small>Recebido</small><strong>{formatCents(dashboard.totals.receivedCents)}</strong></div>
        <div><small>Vendas de consumo</small><strong>{formatCents(dashboard.totals.consumptionSalesCents)}</strong></div>
      </div> : null}
      <Button type="button" size="lg" className="tv-cash-day-operation-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {activeDay ? 'Fechar caixa' : 'Abrir caixa'}
      </Button>
    </section>

    {mobile ? <MobileSheet open={open} onOpenChange={handleOpenChange}>
      <MobileSheetNav title={activeDay ? 'Fechar caixa' : 'Abrir caixa'} cancelLabel="Fechar" />
      <MobilePanelContent busy={busy}>
        <CashOperationActions restaurantId={restaurantId} role={role} dashboard={dashboard} onUpdated={onUpdated} onBusyChange={setBusy} />
      </MobilePanelContent>
    </MobileSheet> : <ItemPanel
      open={open}
      onOpenChange={handleOpenChange}
      title={activeDay ? 'Fechar caixa' : 'Abrir caixa'}
      subtitle="Confira os valores antes de confirmar a operação."
    >
      <DesktopPanelContent busy={busy}>
        <CashOperationActions restaurantId={restaurantId} role={role} dashboard={dashboard} onUpdated={onUpdated} onBusyChange={setBusy} />
      </DesktopPanelContent>
    </ItemPanel>}
  </>
}

function CashOperationActions({ restaurantId, role, dashboard, onUpdated, onBusyChange }: {
  restaurantId: string
  role: MemberRole
  dashboard: FinanceDashboardDTO
  onUpdated: (dashboard: FinanceDashboardDTO) => void
  onBusyChange: (busy: boolean) => void
}) {
  return dashboard.activeDay
    ? <CashDayClosing restaurantId={restaurantId} dashboard={dashboard} role={role} onUpdated={onUpdated} onBusyChange={onBusyChange} />
    : <CashDayOpening restaurantId={restaurantId} onUpdated={onUpdated} onBusyChange={onBusyChange} />
}

function MobilePanelContent({ busy, children }: { busy: boolean; children: ReactNode }) {
  useSheetBusy(busy)
  return <div className="tv-cash-operation-panel-body">{children}</div>
}

function DesktopPanelContent({ busy, children }: { busy: boolean; children: ReactNode }) {
  useItemPanelGuard(busy, () => true)
  return <div className="tv-cash-operation-panel-body">{children}</div>
}
