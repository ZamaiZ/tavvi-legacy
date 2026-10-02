'use client'

import { useState, useTransition } from 'react'
import { LuCheck, LuTrash2, LuUserMinus } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetBusy } from '@/components/shell/mobile-sheet'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { MEMBER_ROLE_HINTS, MEMBER_ROLE_LABELS, type MemberDTO, type MemberRole } from '@/domain/invite'
import { formatShort } from '@/lib/format-date'
import { personInitials } from '@/lib/initials'
import { changeMemberRoleAction, removeMemberAction } from '@/server/actions/members'
import { PanelConfirm } from '../panel-confirm'

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]

// Membro da equipe no celular: papel em lista de escolha única (grava na
// hora), data de entrada e "Remover da equipe". Você mesmo não muda o
// próprio papel nem se remove, como no desktop.
export function MemberSheet({
  member,
  isSelf,
  open,
  onOpenChange,
}: {
  member: MemberDTO
  isSelf: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} detent="content">
      <MemberBody member={member} isSelf={isSelf} />
    </MobileSheet>
  )
}

function MemberBody({ member, isSelf }: { member: MemberDTO; isSelf: boolean }) {
  const { forceClose } = useMobileSheet()
  const [role, setRole] = useState<MemberRole>(member.role)
  const [pending, startTransition] = useTransition()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [changingTo, setChangingTo] = useState<MemberRole | null>(null)
  useSheetBusy(pending)
  const primary = member.displayName ?? member.email ?? 'Sem identificação'
  const secondary = member.displayName && member.email ? member.email : null
  const label = member.email ?? member.displayName ?? 'este membro'

  function choose(next: MemberRole) {
    if (isSelf || pending || next === role) return
    const previous = role
    setRole(next)
    setChangingTo(next)
    startTransition(async () => {
      const result = await changeMemberRoleAction({ membershipId: member.membershipId, role: next })
      setChangingTo(null)
      if (result.ok) {
        toast.add({ title: 'Papel atualizado', type: 'success' })
      } else {
        // Reverte: o caso mais comum é a trava do último administrador.
        setRole(previous)
        toast.add({ title: result.error, type: 'error' })
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await removeMemberAction(member.membershipId)
      setRemoveOpen(false)
      toast.add(result.ok ? { title: 'Membro removido', type: 'success' } : { title: result.error, type: 'error' })
      if (result.ok) forceClose()
    })
  }

  return (
    <>
      <MobileSheetNav title="Membro" cancelLabel="Fechar" />
      <section className="tv-mprofile">
        <span className="tv-mprofile-avatar" aria-hidden="true">{personInitials(member)}</span>
        <div>
          <h3>{primary}</h3>
          {secondary ? <p>{secondary}</p> : null}
        </div>
      </section>
      <h3 className="tv-msheet-label">Papel</h3>
      <div className="tv-group" role="radiogroup" aria-label="Papel">
        {ROLES.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={role === option} className="tv-choice" disabled={isSelf || pending} onClick={() => choose(option)}>
            <span><strong>{MEMBER_ROLE_LABELS[option]}</strong><small>{MEMBER_ROLE_HINTS[option]}</small></span>
            {changingTo === option ? <SpinnerRing label="Atualizando o papel" /> : role === option ? <LuCheck aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      {isSelf ? <p className="tv-sheet-m-note">Você não pode mudar o próprio papel.</p> : null}
      <div className="tv-group">
        <div className="tv-group-row"><span>Na equipe desde</span><span>{formatShort(member.joinedAt)}</span></div>
      </div>
      {!isSelf ? (
        <div className="tv-group">
          <button type="button" className="tv-group-danger" disabled={pending} onClick={() => setRemoveOpen(true)}>
            <LuUserMinus aria-hidden="true" />Remover da equipe
          </button>
        </div>
      ) : null}
      <PanelConfirm
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        icon={<LuTrash2 />}
        title={`Remover ${label}?`}
        description="A pessoa perde o acesso a este restaurante na hora. Para voltar, precisará de um convite novo."
        confirmLabel="Remover"
        pendingLabel="Removendo…"
        pending={pending && removeOpen}
        destructive
        onConfirm={remove}
      />
    </>
  )
}
