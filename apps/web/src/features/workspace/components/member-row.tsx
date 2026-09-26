'use client'

import { useState, useTransition } from 'react'
import { RiDeleteBinLine } from 'react-icons/ri'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { TableCell, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import {
  MEMBER_ROLE_LABELS,
  type MemberDTO,
  type MemberRole,
} from '@/domain/invite'
import {
  changeMemberRoleAction,
  removeMemberAction,
} from '@/server/actions/members'

export function MemberRow({
  member,
  variant = 'row',
  isSelf = false,
}: {
  member: MemberDTO
  variant?: 'row' | 'card'
  isSelf?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [papel, setPapel] = useState<MemberRole>(member.role)

  // Duas letras no máximo. Nome com sobrenome dá as duas iniciais; e-mail dá
  // a primeira letra antes do arroba. O ponto de interrogação cobre o membro
  // sem nome nem e-mail, que o banco permite.
  const fonte = member.displayName ?? member.email ?? ''
  const iniciais =
    fonte
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('') || '?'
  const [removeOpen, setRemoveOpen] = useState(false)

  function updateRole(nextRole: MemberRole) {
    const anterior = papel
    setPapel(nextRole)

    startTransition(async () => {
      const result = await changeMemberRoleAction({
        membershipId: member.membershipId,
        role: nextRole,
      })

      if (result.ok) {
        toast.add({ title: 'Papel atualizado', type: 'success' })
      } else {
        // Reverte. Um seletor mostrando o papel novo depois de a gravação ter
        // falhado mente sobre o estado do sistema — e o caso mais comum aqui
        // é justamente a trava do último administrador.
        setPapel(anterior)
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  function removeMember() {
    startTransition(async () => {
      const result = await removeMemberAction(member.membershipId)
      toast.add(
        result.ok
          ? { title: 'Membro removido', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  const removeDialog = (
    <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remover {member.email ?? member.displayName ?? 'este membro'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A pessoa perde o acesso a este restaurante na hora. Para voltar,
            precisará de um convite novo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={removeMember}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (variant === 'card') {
    return (
      <article className="tavvi-surface p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback>{iniciais}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {member.displayName ?? member.email ?? 'Sem identificação'}
            </p>
            {member.displayName && member.email ? (
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4">
          <NativeSelect
            value={papel}
            disabled={pending || isSelf}
            aria-label={`Papel de ${member.email ?? member.displayName ?? 'membro'}`}
            onChange={(event) => updateRole(event.target.value as MemberRole)}
          >
            {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => (
              <option key={role} value={role}>{MEMBER_ROLE_LABELS[role]}</option>
            ))}
          </NativeSelect>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {isSelf ? 'Você · ' : 'Desde '}{new Date(member.joinedAt).toLocaleDateString('pt-BR')}
            </span>
            {isSelf ? <span className="text-xs font-medium text-muted-foreground">Seu acesso</span> : <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoveOpen(true)}>
              <RiDeleteBinLine className="size-4" /> Remover
            </Button>}
          </div>
        </div>
        {removeDialog}
      </article>
    )
  }

  return (
    <TableRow className="h-14">
      <TableCell>
        <div className="flex items-center gap-3">
          {/* `Avatar` com as iniciais. O primitivo existia desde a Fase 1 e
              nunca tinha sido importado por nenhuma tela — era uma das 42
              peças do sistema de design que o painel ignorava.

              Não há foto de perfil no produto, e nem por isso a lista precisa
              ser só texto: a inicial dá âncora visual para percorrer uma
              equipe de dez pessoas. */}
          <Avatar className="size-9 shrink-0">
            <AvatarFallback>{iniciais}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <span className="block truncate font-medium">
              {member.displayName ?? member.email ?? 'Sem identificação'}
            </span>
            {member.displayName && member.email ? (
              <span className="block truncate text-small text-muted-foreground">
                {member.email}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <NativeSelect
          value={papel}
          disabled={pending || isSelf}
          aria-label={`Papel de ${member.email ?? member.displayName ?? 'membro'}`}
          onChange={(event) => updateRole(event.target.value as MemberRole)}
        >
          {(Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]).map((role) => (
            <option key={role} value={role}>
              {MEMBER_ROLE_LABELS[role]}
            </option>
          ))}
        </NativeSelect>
      </TableCell>

      <TableCell className="text-muted-foreground">
        {new Date(member.joinedAt).toLocaleDateString('pt-BR')}
      </TableCell>

      <TableCell>
        {!isSelf ? <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setRemoveOpen(true)}
        >
          <RiDeleteBinLine className="size-4" />
          Remover
        </Button> : <span className="text-xs text-muted-foreground">Você</span>}

        {/* Irmão do botão, controlado por estado. Diálogo montado dentro de
            menu suspenso some junto com o menu e nunca chega a aparecer. */}
        {removeDialog}
      </TableCell>
    </TableRow>
  )
}
