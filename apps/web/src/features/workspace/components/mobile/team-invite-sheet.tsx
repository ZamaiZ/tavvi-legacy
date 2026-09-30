'use client'

import { LuArrowRight, LuCheck, LuCopy, LuMail, LuMinus, LuPlus, LuTriangleAlert } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetGuard } from '@/components/shell/mobile-sheet'
import { Combobox } from '@/components/ui/combobox'
import { toast } from '@/components/ui/toast'
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/domain/invite'
import { useTeamInvite } from '@/features/invitations/components/use-team-invite'
import { PanelConfirm } from '../panel-confirm'

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]

// "Convidar" no celular: o sheet do convite do console (InviteSheetMobile)
// com a linha Papel a mais. O link aparece uma vez só; fechar sem copiar
// pergunta antes.
export function TeamInviteSheet({
  restaurantId,
  restaurantName,
  open,
  onOpenChange,
}: {
  restaurantId: string
  restaurantName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <TeamInviteBody restaurantId={restaurantId} restaurantName={restaurantName} />
    </MobileSheet>
  )
}

function TeamInviteBody({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const { forceClose } = useMobileSheet()
  const invite = useTeamInvite(restaurantId)

  useSheetGuard(() => {
    if (invite.pending) return false
    if (invite.link && !invite.copied) {
      invite.setDiscard(true)
      return false
    }
    return true
  })

  function done() {
    forceClose()
    toast.add({ title: 'Convite criado', type: 'success' })
  }

  return (
    <>
      <MobileSheetNav title="Novo convite" />
      {invite.link ? (
        <div className="tv-sheet-m-body">
          <div className="tv-sheet-m-done">
            <span><LuCheck aria-hidden="true" /></span>
            <h3>Convite criado</h3>
            <p>Copie agora. O link não será exibido novamente.</p>
          </div>
          <div ref={invite.linkRef} className="tv-sheet-m-link" tabIndex={0} aria-label="Link do convite">{invite.link}</div>
          <div className="tv-sheet-m-warning">
            <LuTriangleAlert aria-hidden="true" />
            <span>Se você fechar sem copiar, terá que emitir outro convite.</span>
          </div>
          <div className="tv-sheet-m-spacer" />
          <button type="button" className="tv-m-pill is-secondary" onClick={invite.copy}>
            {invite.copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
            {invite.copied ? 'Link copiado' : 'Copiar link'}
          </button>
          <button type="button" className="tv-m-pill is-primary tv-sheet-m-cta" disabled={!invite.copied && !invite.manualCopy} onClick={done}>
            Já copiei o link
          </button>
        </div>
      ) : (
        <form
          className="tv-sheet-m-body"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            invite.submit()
          }}
        >
          <p className="tv-sheet-m-lead">Convide alguém para a equipe de {restaurantName}.</p>
          {invite.error ? <p role="alert" className="tv-sheet-m-error">{invite.error}</p> : null}
          <label className="tv-sheet-m-field">
            <LuMail aria-hidden="true" />
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              aria-label="E-mail (opcional)"
              placeholder="E-mail (opcional)"
              value={invite.email}
              onChange={(event) => invite.setEmail(event.target.value)}
            />
          </label>
          <p className="tv-sheet-m-note">Preenchido, o link só funciona para quem entrar com esse e-mail.</p>
          <Combobox
            variant="row"
            className="tv-sheet-m-role"
            label="Papel"
            options={ROLES.map((role) => ({ value: role, label: MEMBER_ROLE_LABELS[role] }))}
            value={invite.role}
            onValueChange={(value) => invite.setRole(value as MemberRole)}
          />
          <div className="tv-sheet-m-validity" role="group" aria-label="Validade">
            <span>Validade</span>
            <output aria-live="polite">{invite.days} {invite.days === 1 ? 'dia' : 'dias'}</output>
            <span className="tv-sheet-m-stepper">
              <button type="button" aria-label="Menos dias" disabled={invite.days <= 1} onPointerDown={() => invite.startHold(-1)} onPointerUp={invite.stopHold} onPointerLeave={invite.stopHold} onClick={() => invite.stepDays(-1)}><LuMinus aria-hidden="true" /></button>
              <i aria-hidden="true" />
              <button type="button" aria-label="Mais dias" disabled={invite.days >= 30} onPointerDown={() => invite.startHold(1)} onPointerUp={invite.stopHold} onPointerLeave={invite.stopHold} onClick={() => invite.stepDays(1)}><LuPlus aria-hidden="true" /></button>
            </span>
          </div>
          <p className="tv-sheet-m-note">Entre 1 e 30 dias. Quem aceitar dentro do prazo não perde o acesso depois.</p>
          <div className="tv-sheet-m-spacer" />
          <button type="submit" className="tv-m-pill is-primary tv-sheet-m-cta" disabled={invite.pending} aria-busy={invite.pending || undefined}>
            {invite.pending ? <><span className="tv-spinner" aria-hidden="true" />Gerando…</> : <>Gerar link<LuArrowRight aria-hidden="true" /></>}
          </button>
        </form>
      )}
      <PanelConfirm
        open={invite.discard}
        onOpenChange={invite.setDiscard}
        icon={<LuTriangleAlert />}
        title="Descartar link?"
        description="Esse link é exibido uma única vez."
        confirmLabel="Descartar"
        cancelLabel="Voltar ao link"
        destructive
        onConfirm={forceClose}
      />
    </>
  )
}
