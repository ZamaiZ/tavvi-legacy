'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowRightLeft, LuX } from 'react-icons/lu'
import type { ServiceCallDTO, ServiceCallTeamMemberDTO } from '@/domain/service-call'

export function ServiceCallTransferDialog({
  open,
  call,
  team,
  busy,
  onClose,
  onTransfer,
}: {
  open: boolean
  call: ServiceCallDTO | null
  team: ServiceCallTeamMemberDTO[]
  busy: boolean
  onClose: () => void
  onTransfer: (assigneeId: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const candidates = useMemo(
    () => team.filter((member) => member.userId !== call?.assignedTo),
    [call?.assignedTo, team],
  )
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    setAssigneeId(candidates[0]?.userId ?? '')
  }, [call?.id, candidates])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog
    ref={dialogRef}
    className="tv-call-transfer-dialog"
    aria-labelledby="tv-call-transfer-title"
    aria-describedby="tv-call-transfer-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
  >
    <div className="tv-call-transfer-head">
      <span className="tv-call-transfer-symbol"><LuArrowRightLeft aria-hidden="true" /></span>
      <button type="button" className="tv-call-dialog-close" aria-label="Fechar transferência" disabled={busy} onClick={onClose}><LuX aria-hidden="true" /></button>
      <p>Organização da equipe</p>
      <h2 id="tv-call-transfer-title">Transferir chamado</h2>
      <span id="tv-call-transfer-description">Mesa {call?.tableNumber} · O tempo de espera original será preservado.</span>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); if (assigneeId) onTransfer(assigneeId) }}>
      <label htmlFor="tv-call-transfer-assignee">Novo responsável</label>
      <select id="tv-call-transfer-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} disabled={busy || candidates.length === 0}>
        {candidates.length ? candidates.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>) : <option value="">Não há outra pessoa disponível</option>}
      </select>
      {!candidates.length ? <p className="tv-call-transfer-empty">Convide mais uma pessoa para a equipe antes de transferir o atendimento.</p> : null}
      <div className="tv-call-transfer-actions">
        <button type="button" className="tv-call-button is-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button type="submit" className="tv-call-button is-primary" disabled={busy || !assigneeId}>{busy ? 'Transferindo…' : 'Confirmar transferência'}</button>
      </div>
    </form>
  </dialog>
}
