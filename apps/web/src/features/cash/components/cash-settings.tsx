'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuX } from 'react-icons/lu'
import type { CheckoutSettingsDTO, TipMode } from '@/domain/table-account'
import { digitsToCents, formatCentsInput } from '@/lib/money'
import { SpinnerRing } from '@/components/ui/spinner'
import { MobileSheet, MobileSheetNav, useSheetBusy } from '@/components/shell/mobile-sheet'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'
import {
  createCustomPaymentMethodAction,
  getCheckoutSettingsAction,
  saveCheckoutSettingsAction,
  setPaymentMethodActiveAction,
} from '@/server/actions/table-accounts'

export function CashSettings({ restaurantId, settings, mobile, open, onOpenChange, onSaved }: {
  restaurantId: string
  settings: CheckoutSettingsDTO
  mobile: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (settings: CheckoutSettingsDTO) => void
}) {
  const container = useTerritoryContainer()
  const [tipMode, setTipMode] = useState<TipMode>(settings.tipMode)
  const [percent, setPercent] = useState(settings.tipPercentBps === null ? '' : String(settings.tipPercentBps / 100))
  const [fixed, setFixed] = useState(settings.tipFixedCents === null ? '' : formatCentsInput(settings.tipFixedCents))
  const [customName, setCustomName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, startTransition] = useTransition()

  async function reloadSettings() {
    const result = await getCheckoutSettingsAction(restaurantId)
    if (!result.ok) throw new Error(result.error)
    onSaved(result.data)
  }

  function saveTip() {
    const percentNumber = percent.trim() ? Number(percent.replace(',', '.')) : null
    const percentBps = percentNumber === null ? null : Number.isFinite(percentNumber) ? Math.round(percentNumber * 100) : NaN
    const fixedCents = digitsToCents(fixed)
    const input = {
      restaurantId,
      tipMode,
      tipPercentBps: tipMode === 'percentage' ? percentBps : null,
      tipFixedCents: tipMode === 'fixed' ? fixedCents : null,
    }
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const result = await saveCheckoutSettingsAction(input)
        if (!result.ok) { setError(result.error); return }
        await reloadSettings()
        setSaved(true)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar a configuração salva.')
      }
    })
  }

  function toggleMethod(methodId: string, isActive: boolean) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await setPaymentMethodActiveAction({ restaurantId, methodId, isActive })
        if (!result.ok) { setError(result.error); return }
        await reloadSettings()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar as formas.')
      }
    })
  }

  function addCustomMethod() {
    if (!customName.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await createCustomPaymentMethodAction({ restaurantId, name: customName.trim() })
        if (!result.ok) { setError(result.error); return }
        setCustomName('')
        await reloadSettings()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar as formas.')
      }
    })
  }

  const sections = <>
    <section className="tv-cash-settings-section">
      <div className="tv-cash-settings-section-heading"><span>01</span><div><h3>Gorjeta da comanda</h3><p>Uma decisão por comanda, quando a equipe iniciar o fechamento.</p></div></div>
      <label className="tv-cash-settings-field"><span>Critério aplicado às novas comandas</span><select value={tipMode} disabled={busy} onChange={(event) => { setTipMode(event.target.value as TipMode); setSaved(false) }}>
        <option value="disabled">Desativada</option><option value="percentage">Percentual sobre o subtotal</option><option value="fixed">Valor fixo por comanda</option>
      </select></label>
      {tipMode === 'percentage' ? <label className="tv-cash-settings-field"><span>Percentual (%)</span><input inputMode="decimal" value={percent} disabled={busy} onChange={(event) => { setPercent(event.target.value); setSaved(false) }} placeholder="10" /></label> : null}
      {tipMode === 'fixed' ? <label className="tv-cash-settings-field"><span>Valor fixo</span><span className="tv-cash-money-field"><b>R$</b><input inputMode="numeric" value={fixed} disabled={busy} onChange={(event) => { setFixed(event.target.value); setSaved(false) }} onBlur={() => { const cents = digitsToCents(fixed); if (cents !== null) setFixed(formatCentsInput(cents)) }} /></span></label> : null}
      <p className="tv-cash-settings-hint">A regra fica registrada na abertura de cada comanda. O cliente pode recusar a gorjeta no fechamento.</p>
      <div className="tv-cash-settings-actions"><button type="button" disabled={busy} onClick={saveTip}>{busy ? <SpinnerRing decorative /> : null}Salvar política de gorjeta</button>{saved ? <small className="tv-cash-settings-saved" role="status">Salva para as próximas comandas.</small> : null}</div>
    </section>

    <section className="tv-cash-settings-section">
      <div className="tv-cash-settings-section-heading"><span>02</span><div><h3>Formas de pagamento</h3><p>Ative as opções usadas no caixa ou cadastre uma forma do restaurante.</p></div></div>
      <p className="tv-cash-settings-hint">Mantenha ao menos uma forma ativa. Opções já usadas continuam no histórico, mesmo depois de desativadas.</p>
      <ul>{settings.paymentMethods.map((method) => <li key={method.id}>
        <span><strong>{method.name}</strong><small>{method.methodType === 'custom' ? 'Personalizada' : 'Opção padrão'}</small></span>
        <label className="tv-cash-switch"><span className="tv-cash-switch-label">{method.isActive ? 'Ativa' : 'Inativa'}</span><input type="checkbox" checked={method.isActive} disabled={busy} aria-label={`${method.isActive ? 'Desativar' : 'Ativar'} ${method.name}`} onChange={(event) => toggleMethod(method.id, event.target.checked)} /><i aria-hidden="true" /></label>
      </li>)}</ul>
      <div className="tv-cash-custom-method"><label><span>Adicionar forma personalizada</span><input value={customName} disabled={busy} maxLength={60} onChange={(event) => setCustomName(event.target.value)} placeholder="Ex.: consumo interno" /></label><button type="button" disabled={busy || !customName.trim()} onClick={addCustomMethod}>{busy ? <SpinnerRing decorative /> : null}Adicionar forma</button></div>
    </section>
    {error ? <p className="tv-cash-inline-error" role="alert">{error}</p> : null}
  </>

  if (mobile) {
    return <MobileSheet open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }} detent="page">
      <MobileSheetNav title="Configurações do caixa" cancelLabel="Fechar" />
      <CashSettingsMobileContent busy={busy}>{sections}</CashSettingsMobileContent>
    </MobileSheet>
  }

  return <Dialog.Root open={open} disablePointerDismissal={busy} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="tv-cash-dialog-backdrop" />
      <Dialog.Popup className="tv-cash-settings-dialog" aria-busy={busy || undefined}>
        <header className="tv-cash-settings-dialog-header">
          <div><Dialog.Title className="tv-cash-settings-dialog-title">Configurações do caixa</Dialog.Title><Dialog.Description className="tv-cash-settings-dialog-description">Defina gorjeta e meios usados para registrar os recebimentos deste restaurante.</Dialog.Description></div>
          <button type="button" className="tv-cash-dialog-close" aria-label="Fechar configurações do caixa" disabled={busy} onClick={() => onOpenChange(false)}><LuX aria-hidden="true" /></button>
        </header>
        <div className="tv-cash-settings-dialog-content">{sections}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function CashSettingsMobileContent({ busy, children }: { busy: boolean; children: ReactNode }) {
  useSheetBusy(busy)
  return <div className="tv-cash-settings-mobile-content">{children}</div>
}
