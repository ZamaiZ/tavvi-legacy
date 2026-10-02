'use client'

import { useState, useTransition } from 'react'
import { LuCopy, LuTrash2, LuUserCog, LuUserMinus } from 'react-icons/lu'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import {
  MEMBER_ROLE_LABELS,
  type MemberDTO,
  type MemberRole,
} from '@/domain/invite'
import { copyText } from '@/lib/copy-text'
import { formatShort } from '@/lib/format-date'
import {
  changeMemberRoleAction,
  removeMemberAction,
} from '@/server/actions/members'
import { TeamConfirmDialog } from './team-confirm-dialog'

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]
const ROLE_OPTIONS: ComboboxOption[] = ROLES.map((role) => ({ value: role, label: MEMBER_ROLE_LABELS[role] }))

export function MemberRow({
  member,
  isSelf = false,
}: {
  member: MemberDTO
  isSelf?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [papel, setPapel] = useState<MemberRole>(member.role)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  // Duas letras no máximo. Nome com sobrenome dá as duas iniciais; e-mail dá
  // as iniciais das partes antes do domínio. O ponto de interrogação cobre o
  // membro sem nome nem e-mail, que o banco permite.
  const fonte = member.displayName ?? member.email ?? ''
  const iniciais =
    fonte
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('') || '?'
  const primary = member.displayName ?? member.email ?? 'Sem identificação'
  const secondary = member.displayName && member.email ? member.email : null
  const label = member.email ?? member.displayName ?? 'membro'

  function updateRole(nextRole: MemberRole) {
    const anterior = papel
    setPapel(nextRole)
    setChanging(true)

    startTransition(async () => {
      const result = await changeMemberRoleAction({
        membershipId: member.membershipId,
        role: nextRole,
      })
      setChanging(false)

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
      setRemoveOpen(false)
      toast.add(
        result.ok
          ? { title: 'Membro removido', type: 'success' }
          : { title: result.error, type: 'error' },
      )
    })
  }

  const removeDialog = (
    <TeamConfirmDialog
      open={removeOpen}
      onOpenChange={setRemoveOpen}
      icon={<LuTrash2 />}
      title={`Remover ${member.email ?? member.displayName ?? 'este membro'}?`}
      description="A pessoa perde o acesso a este restaurante na hora. Para voltar, precisará de um convite novo."
      confirmLabel="Remover"
      pendingLabel="Removendo…"
      pending={pending}
      onConfirm={removeMember}
    />
  )

  // No desktop, o botão direito repete as ações da linha (spec de
  // componentes §4.3). Em você mesmo, só copiar o e-mail.
  return (
    <ContextMenu disabled={isSelf && !member.email}>
      <ContextMenuTrigger render={<div role="row" className="tv-team-row tv-team-columns" />}>
        <div role="cell" className="tv-team-person">
          <span className="tv-team-avatar" aria-hidden="true">{iniciais}</span>
          <span className="tv-row-copy">
            <strong className="tv-row-title">{primary}</strong>
            {secondary ? <small className="tv-row-meta">{secondary}</small> : null}
          </span>
        </div>

        <div role="cell" className="tv-team-role-cell" aria-busy={changing || undefined}>
          {/* Você mesmo não muda o próprio papel: a trava evita se rebaixar
              sem querer. A do último administrador fica no servidor. */}
          <Combobox
            label={`Papel de ${label}`}
            options={ROLE_OPTIONS}
            value={papel}
            onValueChange={(next) => updateRole(next as MemberRole)}
            size="sm"
            disabled={pending || isSelf}
            className="tv-team-combo"
          />
          {changing ? <SpinnerRing label="Atualizando o papel" className="tv-team-role-spinner" /> : null}
        </div>

        <div role="cell" className="tv-date-cell">
          {formatShort(member.joinedAt)}
        </div>

        <div role="cell" className="tv-team-actions">
          {isSelf ? (
            <span className="tv-team-self">Você</span>
          ) : (
            <button
              type="button"
              className="tv-team-remove"
              disabled={pending}
              aria-label={`Remover ${label}`}
              onClick={() => setRemoveOpen(true)}
            >
              <LuTrash2 aria-hidden="true" />
              Remover
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Ações de ${label}`}>
        {isSelf ? null : (
          <ContextMenuSub>
            <ContextMenuSubTrigger><LuUserCog aria-hidden="true" /><span>Papel</span></ContextMenuSubTrigger>
            <ContextMenuSubContent aria-label="Papel">
              <ContextMenuRadioGroup value={papel} onValueChange={(next) => updateRole(next as MemberRole)}>
                {ROLE_OPTIONS.map((option) => <ContextMenuRadioItem key={option.value} value={option.value} disabled={pending}>{option.label}</ContextMenuRadioItem>)}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {member.email ? <ContextMenuItem onClick={() => void copyText(member.email!, 'E-mail copiado')}><LuCopy aria-hidden="true" /><span>Copiar e-mail</span></ContextMenuItem> : null}
        {isSelf ? null : (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" disabled={pending} onClick={() => setRemoveOpen(true)}><LuUserMinus aria-hidden="true" /><span>Remover da equipe</span></ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
      {removeDialog}
    </ContextMenu>
  )
}
