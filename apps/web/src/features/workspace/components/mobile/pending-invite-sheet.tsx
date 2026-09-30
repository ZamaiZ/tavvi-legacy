'use client'

import { useState, useTransition } from 'react'
import { LuBan, LuMail } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet } from '@/components/shell/mobile-sheet'
import { toast } from '@/components/ui/toast'
import { MEMBER_ROLE_LABELS, type InviteDTO } from '@/domain/invite'
import { formatLong } from '@/lib/format-date'
import { revokeInviteAction } from '@/server/actions/invites'
import { PanelConfirm } from '../panel-confirm'

// Convite pendente no celular: como o detalhe de convite do console, com
// "Revogar convite".
export function PendingInviteSheet({
  invite,
  open,
  onOpenChange,
}: {
  invite: InviteDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} detent="content">
      <PendingInviteBody invite={invite} />
    </MobileSheet>
  )
}

function PendingInviteBody({ invite }: { invite: InviteDTO }) {
  const { forceClose } = useMobileSheet()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function revoke() {
    startTransition(async () => {
      const result = await revokeInviteAction(invite.id)
      toast.add(result.ok ? { title: 'Convite revogado', type: 'success' } : { title: result.error, type: 'error' })
      if (result.ok) forceClose()
    })
  }

  return (
    <>
      <MobileSheetNav title="Convite" cancelLabel="Fechar" />
      <section className="tv-mprofile">
        <div className="tv-mprofile-top">
          <span className="tv-mprofile-icon" aria-hidden="true"><LuMail /></span>
          <span className="tv-mprofile-pill">Pendente</span>
        </div>
        <div>
          <h3>{invite.email ?? 'Qualquer e-mail'}</h3>
          <p>{MEMBER_ROLE_LABELS[invite.role]} · Válido até {formatLong(invite.expiresAt)}</p>
        </div>
      </section>
      <button type="button" className="tv-m-pill is-danger tv-mprofile-action" disabled={pending} onClick={() => setConfirmOpen(true)}>
        <LuBan aria-hidden="true" />Revogar convite
      </button>
      <PanelConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={<LuBan />}
        title="Revogar convite?"
        description="O link deixará de funcionar imediatamente."
        confirmLabel="Revogar"
        destructive
        onConfirm={revoke}
      />
    </>
  )
}
