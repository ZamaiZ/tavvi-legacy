'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuX } from 'react-icons/lu'
import type { OrderLineInput, OrderableMenuCategoryDTO } from '@/domain/orders'
import type { TableAccountSummaryDTO } from '@/domain/table-account'
import { formatTableAccountIdentity } from '@/domain/table-account'
import { recordCashTableOrderAction } from '@/server/actions/orders'
import { MobileSheet, MobileSheetNav, useSheetBusy } from '@/components/shell/mobile-sheet'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'
import { OrderComposer, type OrderComposerSubmitResult } from '@/features/orders/components/order-composer'

export function CashOrderDialog({ open, onOpenChange, restaurantId, menu, mobile, target, onRecorded }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  menu: OrderableMenuCategoryDTO[]
  mobile: boolean
  target: TableAccountSummaryDTO | null
  onRecorded: (accountId: string) => Promise<void>
}) {
  const container = useTerritoryContainer()
  const [accountName, setAccountName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [retryRequired, setRetryRequired] = useState(false)

  useEffect(() => {
    if (!open) return
    setAccountName('')
    setTableNumber('')
    setRetryRequired(false)
  }, [open, target?.accountId])

  async function submit(requestId: string, items: OrderLineInput[]): Promise<OrderComposerSubmitResult> {
    if (submitting) return { ok: false, error: 'O pedido ainda está sendo registrado.', retryable: true }
    let parsedTableNumber: number | null = null
    if (!target && tableNumber.trim()) {
      if (!/^[0-9]{1,6}$/.test(tableNumber.trim()) || Number(tableNumber) < 1) {
        return { ok: false, error: 'Informe um número de mesa válido ou deixe o campo vazio.', retryable: false }
      }
      parsedTableNumber = Number(tableNumber)
    }
    const normalizedName = accountName.trim() || null
    if (normalizedName && normalizedName.length > 80) {
      return { ok: false, error: 'O nome da comanda deve ter até 80 caracteres.', retryable: false }
    }

    setSubmitting(true)
    try {
      const result = await recordCashTableOrderAction({
        restaurantId,
        accountId: target?.accountId ?? null,
        tableNumber: target ? null : parsedTableNumber,
        accountName: target ? null : normalizedName,
        requestId,
        items,
      })
      if (!result.ok) {
        const definitive = [
          'Você não tem permissão', 'Confira o nome da comanda', 'Um item ou preço mudou',
          'Escolha uma variação', 'A conta desta comanda está em fechamento',
          'A conta desta comanda já foi encerrada', 'A comanda selecionada não está mais disponível',
          'A conta desta mesa mudou durante o registro', 'As configurações do caixa não estão disponíveis',
          'O total da comanda excede',
        ].some((message) => result.error.includes(message))
        return { ok: false, error: result.error, retryable: !definitive }
      }
      await onRecorded(result.data.accountId)
      onOpenChange(false)
      return { ok: true }
    } catch {
      return { ok: false, error: 'A resposta ficou incerta. Repita a confirmação sem alterar os itens ou a identidade da comanda.', retryable: true }
    } finally {
      setSubmitting(false)
    }
  }

  const form = <>
    {target ? <div className="tv-cash-order-identity-readonly"><span>Comanda selecionada</span><strong>{formatTableAccountIdentity(target)}</strong><small>O pedido será acrescentado à conta aberta.</small></div> : <div className="tv-cash-order-fields">
      <label><span>Nome da comanda <small>Opcional</small></span><input value={accountName} maxLength={80} disabled={retryRequired || submitting} onChange={(event) => setAccountName(event.target.value)} placeholder="Ex.: Família Silva" /></label>
      <label><span>Mesa <small>Opcional</small></span><input value={tableNumber} inputMode="numeric" maxLength={6} disabled={retryRequired || submitting} onChange={(event) => setTableNumber(event.target.value.replace(/[^0-9]/g, ''))} placeholder="Número da mesa" /></label>
      <p>Sem mesa, será criada uma comanda independente. Se nome e mesa ficarem vazios, o sistema atribui um número automaticamente. Se a mesa já tiver conta aberta, o pedido será anexado; o nome só preenche um apelido ainda vazio.</p>
    </div>}
    <OrderComposer
      menu={menu}
      mobile={mobile}
      orderLabel={target ? formatTableAccountIdentity(target) : 'Novo pedido · Caixa'}
      onSubmit={submit}
      onRetryStateChange={setRetryRequired}
    />
  </>

  if (mobile) return <MobileSheet open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }} detent="page">
    <MobileSheetNav title={target ? 'Lançar pedido' : 'Novo pedido'} cancelLabel="Fechar" />
    <MobileCashOrderContent busy={submitting}>{form}</MobileCashOrderContent>
  </MobileSheet>

  return <Dialog.Root open={open} disablePointerDismissal={submitting} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="tv-cash-order-dialog-backdrop" />
      <Dialog.Popup className="tv-cash-order-dialog" aria-busy={submitting || undefined}>
        <header><div><Dialog.Title className="tv-cash-order-dialog-title">{target ? 'Lançar pedido na comanda' : 'Novo pedido no caixa'}</Dialog.Title><Dialog.Description className="tv-cash-order-dialog-description">Escolha os itens e confirme para lançar o consumo na comanda.</Dialog.Description></div>
          <button type="button" aria-label="Fechar pedido" disabled={submitting} onClick={() => onOpenChange(false)}><LuX aria-hidden="true" /></button></header>
        <div className="tv-cash-order-dialog-content">{form}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function MobileCashOrderContent({ busy, children }: { busy: boolean; children: ReactNode }) {
  useSheetBusy(busy)
  return <div className="tv-cash-order-mobile-content">{children}</div>
}
