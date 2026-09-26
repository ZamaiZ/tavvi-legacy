'use client'

import { useTransition } from 'react'
import { RiCloseCircleLine } from 'react-icons/ri'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import {
  INVITE_STATUS_LABELS,
  inviteStatus,
  MEMBER_ROLE_LABELS,
  type InviteDTO,
} from '@/domain/invite'
import { revokeInviteAction } from '@/server/actions/invites'

export function InviteList({
  invites,
  showRole = false,
}: {
  invites: InviteDTO[]
  /** O convite de plataforma é sempre administrador; mostrar a coluna ali
      seria uma coluna com um valor só. */
  showRole?: boolean
}) {
  const [pending, startTransition] = useTransition()

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeInviteAction(id)
      toast.add(
        result.ok
          ? { title: 'Convite revogado', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  return (
    <>
    <div className="tavvi-surface hidden overflow-hidden md:block">
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/35">
          <TableHead>E-mail</TableHead>
          {showRole ? <TableHead>Papel</TableHead> : null}
          <TableHead>Situação</TableHead>
          <TableHead>Prazo</TableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => {
          const status = inviteStatus(invite)
          return (
            <TableRow key={invite.id} className="h-16">
              <TableCell>
                {invite.email ?? (
                  <span className="text-muted-foreground">Qualquer e-mail</span>
                )}
              </TableCell>
              {showRole ? (
                <TableCell>{MEMBER_ROLE_LABELS[invite.role]}</TableCell>
              ) : null}
              <TableCell>
                <Badge
                  variant={status === 'pendente' ? 'default' : 'secondary'}
                >
                  {INVITE_STATUS_LABELS[status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell>
                {/* Revogar só faz sentido no pendente: resgatado já virou
                    vínculo, e vencido já não funciona. Oferecer a ação nos
                    outros casos seria oferecer um clique que não faz nada. */}
                {status === 'pendente' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => revoke(invite.id)}
                  >
                    <RiCloseCircleLine className="size-4" />
                    Revogar
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
    </div>
    <div className="grid gap-3 md:hidden">
      {invites.map((invite) => {
        const status = inviteStatus(invite)
        return (
          <article key={invite.id} className="tavvi-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{invite.email ?? 'Qualquer e-mail'}</p>
                {showRole ? (
                  <p className="mt-1 text-sm text-muted-foreground">{MEMBER_ROLE_LABELS[invite.role]}</p>
                ) : null}
              </div>
              <Badge variant={status === 'pendente' ? 'default' : 'secondary'}>
                {INVITE_STATUS_LABELS[status]}
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                Válido até {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
              </p>
              {status === 'pendente' ? (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => revoke(invite.id)}>
                  <RiCloseCircleLine className="size-4" /> Revogar
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
    </>
  )
}
