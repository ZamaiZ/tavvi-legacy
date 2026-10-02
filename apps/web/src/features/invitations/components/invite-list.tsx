'use client'

import { useState, useTransition } from 'react'
import { LuBan, LuCopy, LuMail } from 'react-icons/lu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { toast } from '@/components/ui/toast'
import { MEMBER_ROLE_LABELS, type InviteDTO } from '@/domain/invite'
import { TeamConfirmDialog } from '@/features/workspace/components/team-confirm-dialog'
import { copyText } from '@/lib/copy-text'
import { formatLong } from '@/lib/format-date'
import { revokeInviteAction } from '@/server/actions/invites'

// Convites de equipe ainda em aberto. A página já entrega só os pendentes:
// o resgatado virou membro, e o vencido ou revogado não abre mais nada.
export function InviteList({ invites }: { invites: InviteDTO[] }) {
  const [pending, startTransition] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function revoke() {
    if (!confirmId) return
    const id = confirmId
    startTransition(async () => {
      const result = await revokeInviteAction(id)
      setConfirmId(null)
      toast.add(
        result.ok
          ? { title: 'Convite revogado', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  return (
    <>
      <ul className="tv-table-shell hidden md:block" aria-label="Convites pendentes">
        {invites.map((invite) => {
          const title = invite.email ?? 'Qualquer e-mail'
          return (
            <ContextMenu key={invite.id}>
              <ContextMenuTrigger render={<li className="tv-team-invite" />}>
                <span className="tv-row-icon">
                  <LuMail aria-hidden="true" />
                </span>
                <span className="tv-row-copy tv-team-invite-copy">
                  <strong className="tv-row-title">{title}</strong>
                  <small className="tv-row-meta">
                    Válido até {formatLong(invite.expiresAt)}
                  </small>
                </span>
                <span className="tv-team-pill">{MEMBER_ROLE_LABELS[invite.role]}</span>
                <span className="tv-team-pill is-pending">
                  <i aria-hidden="true" />
                  Pendente
                </span>
                <button
                  type="button"
                  className="tv-team-revoke"
                  title="Revogar convite"
                  aria-label={`Revogar convite para ${invite.email ?? 'qualquer e-mail'}`}
                  disabled={pending}
                  onClick={() => setConfirmId(invite.id)}
                >
                  <LuBan aria-hidden="true" />
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent aria-label={`Ações do convite para ${title}`}>
                {invite.email ? (
                  <>
                    <ContextMenuItem onClick={() => void copyText(invite.email!, 'E-mail copiado')}><LuCopy aria-hidden="true" /><span>Copiar e-mail</span></ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                ) : null}
                <ContextMenuItem variant="destructive" disabled={pending} onClick={() => setConfirmId(invite.id)}><LuBan aria-hidden="true" /><span>Revogar convite</span></ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </ul>

      <TeamConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null)
        }}
        icon={<LuBan />}
        title="Revogar convite?"
        description="O link deixará de funcionar imediatamente."
        confirmLabel="Revogar"
        pendingLabel="Revogando…"
        pending={pending}
        onConfirm={revoke}
      />
    </>
  )
}
