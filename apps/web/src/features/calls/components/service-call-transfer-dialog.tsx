'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { LuArrowRightLeft, LuX } from 'react-icons/lu'
import { Combobox } from '@/components/ui/combobox'
import { MobileSheet, MobileSheetNav, useSheetBusy } from '@/components/shell/mobile-sheet'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'
import type { ServiceCallDTO, ServiceCallTeamMemberDTO } from '@/domain/service-call'

export function ServiceCallTransferDialog({
  open,
  call,
  team,
  busy,
  mobile,
  onClose,
  onTransfer,
}: {
  open: boolean
  call: ServiceCallDTO | null
  team: ServiceCallTeamMemberDTO[]
  busy: boolean
  mobile: boolean
  onClose: () => void
  onTransfer: (assigneeId: string) => void
}) {
  const container = useTerritoryContainer()
  const candidates = useMemo(
    () => team.filter((member) => member.userId !== call?.assignedTo),
    [call?.assignedTo, team],
  )
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    setAssigneeId(candidates[0]?.userId ?? '')
  }, [call?.id, candidates])

  const form = <form onSubmit={(event) => { event.preventDefault(); if (!busy && assigneeId) onTransfer(assigneeId) }}>
    <div className="tv-call-transfer-field">
      <span>Novo responsável</span>
      <Combobox label="Novo responsável" value={assigneeId || null} placeholder="Escolha uma pessoa" options={candidates.map((member) => ({ value: member.userId, label: member.displayName }))} disabled={busy || !candidates.length} onValueChange={setAssigneeId} />
    </div>
    {!candidates.length ? <p className="tv-call-transfer-empty">Convide mais uma pessoa para a equipe antes de transferir o atendimento.</p> : null}
    <div className="tv-call-transfer-actions">
      <button type="button" className="tv-call-button is-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button type="submit" className="tv-call-button is-primary" disabled={busy || !assigneeId}>{busy ? 'Transferindo…' : 'Confirmar transferência'}</button>
    </div>
  </form>

  if (mobile) return <MobileSheet open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }} detent="content">
    <MobileSheetNav title="Transferir chamado" cancelLabel="Voltar" />
    <TransferSheetBody busy={busy}>
      <div className="tv-call-transfer-head"><span className="tv-call-transfer-symbol"><LuArrowRightLeft aria-hidden="true" /></span><p>Organização da equipe</p><h2>Mesa {call?.tableNumber}</h2><span className="tv-call-transfer-description">O tempo de espera original será preservado.</span></div>
      {form}
    </TransferSheetBody>
  </MobileSheet>

  return <Dialog.Root open={open} disablePointerDismissal={busy} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className="tv-call-transfer-backdrop" />
      <Dialog.Popup className="tv-call-transfer-dialog" aria-busy={busy || undefined}>
        <div className="tv-call-transfer-head">
          <span className="tv-call-transfer-symbol"><LuArrowRightLeft aria-hidden="true" /></span>
          <button type="button" className="tv-call-dialog-close" aria-label="Fechar transferência" disabled={busy} onClick={onClose}><LuX aria-hidden="true" /></button>
          <p>Organização da equipe</p>
          <Dialog.Title>Transferir chamado</Dialog.Title>
          <Dialog.Description className="tv-call-transfer-description">Mesa {call?.tableNumber} · O tempo de espera original será preservado.</Dialog.Description>
        </div>
        {form}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function TransferSheetBody({ busy, children }: { busy: boolean; children: ReactNode }) {
  useSheetBusy(busy)
  return <div className="tv-call-transfer-mobile">{children}</div>
}
