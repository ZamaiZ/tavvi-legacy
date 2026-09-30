'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Dialog } from '@base-ui/react/dialog'
import {
  LuArrowRight,
  LuCheck,
  LuCopy,
  LuMail,
  LuMinus,
  LuPlus,
  LuTriangleAlert,
  LuUserPlus,
  LuX,
} from 'react-icons/lu'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { toast } from '@/components/ui/toast'
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/domain/invite'
import { useTerritoryContainer } from '@/features/workspace/components/use-territory-container'
import { useTeamInvite } from './use-team-invite'

const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[]
const ROLE_OPTIONS: ComboboxOption[] = ROLES.map((role) => ({ value: role, label: MEMBER_ROLE_LABELS[role] }))

// Convite de equipe: o mesmo diálogo do convite de plataforma (README §7.2),
// com o campo Papel a mais. O link aparece uma vez só — o servidor guarda
// apenas uma marca dele —, então fechar sem copiar pede confirmação.
export function InviteDialog({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string
  restaurantName: string
}) {
  const container = useTerritoryContainer()
  const ids = useId()
  const emailRef = useRef<HTMLInputElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const invite = useTeamInvite(restaurantId)

  // Esc, clique fora e o X passam por aqui. Com o link na tela e ainda não
  // copiado, fechar perderia o link de vez: vira a pergunta "Descartar link?".
  function handleOpenChange(next: boolean) {
    if (next) {
      setOpen(true)
      return
    }
    if (invite.pending) return
    if (invite.link && !invite.copied) {
      invite.setDiscard(true)
      return
    }
    setOpen(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invite.submit()
  }

  function done() {
    setOpen(false)
    toast.add({ title: 'Convite criado', type: 'success' })
  }

  // A pergunta some e o conteúdo deixa de ser inerte no mesmo commit; só
  // então dá para devolver o foco ao botão de copiar.
  function backToLink() {
    flushSync(() => invite.setDiscard(false))
    copyRef.current?.focus()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) invite.reset()
      }}
    >
      <Dialog.Trigger className="tv-team-invite-button">
        <LuUserPlus aria-hidden="true" />
        Convidar
      </Dialog.Trigger>

      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="tv-team-scrim" />
        <Dialog.Popup className="tv-team-sheet" initialFocus={emailRef}>
          <Dialog.Close className="tv-team-sheet-close" aria-label="Fechar" inert={invite.discard}>
            <LuX aria-hidden="true" />
          </Dialog.Close>

          {invite.link === null ? (
            <form className="tv-team-sheet-body" onSubmit={submit} noValidate>
              <div className="tv-team-sheet-heading">
                <Dialog.Title className="tv-team-sheet-title">Novo convite</Dialog.Title>
                <Dialog.Description className="tv-team-sheet-description">
                  Convide alguém para a equipe de {restaurantName}.
                </Dialog.Description>
              </div>

              {invite.error ? (
                <p role="alert" className="tv-team-sheet-error">{invite.error}</p>
              ) : null}

              <div className="tv-team-field">
                <label className="tv-team-field-label" htmlFor={`${ids}-email`}>
                  E-mail (opcional)
                </label>
                <span className="tv-team-input">
                  <LuMail aria-hidden="true" />
                  <input
                    ref={emailRef}
                    id={`${ids}-email`}
                    type="email"
                    autoComplete="off"
                    placeholder="Qualquer e-mail"
                    aria-describedby={`${ids}-email-help`}
                    value={invite.email}
                    onChange={(event) => invite.setEmail(event.target.value)}
                  />
                </span>
                <small id={`${ids}-email-help`} className="tv-team-field-help">
                  Preenchido, o link só funciona para quem entrar com esse e-mail.
                </small>
              </div>

              <div className="tv-team-field">
                <label className="tv-team-field-label" htmlFor={`${ids}-role`}>
                  Papel
                </label>
                <Combobox
                  id={`${ids}-role`}
                  label="Papel"
                  options={ROLE_OPTIONS}
                  value={invite.role}
                  onValueChange={(next) => invite.setRole(next as MemberRole)}
                  size="lg"
                  className="tv-team-field-combo"
                />
              </div>

              <div
                className="tv-team-field"
                role="group"
                aria-labelledby={`${ids}-days`}
                aria-describedby={`${ids}-days-help`}
              >
                <span id={`${ids}-days`} className="tv-team-field-label">Validade</span>
                <div className="tv-team-stepper">
                  <button
                    type="button"
                    aria-label="Menos dias"
                    disabled={invite.days <= 1}
                    onClick={() => invite.stepDays(-1)}
                  >
                    <LuMinus aria-hidden="true" />
                  </button>
                  <output aria-live="polite">
                    {invite.days} {invite.days === 1 ? 'dia' : 'dias'}
                  </output>
                  <button
                    type="button"
                    aria-label="Mais dias"
                    disabled={invite.days >= 30}
                    onClick={() => invite.stepDays(1)}
                  >
                    <LuPlus aria-hidden="true" />
                  </button>
                </div>
                <small id={`${ids}-days-help`} className="tv-team-field-help is-long">
                  Escolha entre 1 e 30 dias. Depois desse prazo o link para de
                  funcionar e você emite outro. Quem aceitar dentro do prazo não
                  perde o acesso depois.
                </small>
              </div>

              <button
                type="submit"
                className="tv-team-sheet-cta"
                disabled={invite.pending}
                aria-busy={invite.pending}
              >
                {invite.pending ? (
                  <>
                    <span className="tv-spinner" aria-hidden="true" />
                    Gerando link…
                  </>
                ) : (
                  <>
                    Gerar link
                    <LuArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="tv-team-sheet-body" inert={invite.discard}>
              <div className="tv-team-created-heading">
                <span aria-hidden="true">
                  <LuCheck />
                </span>
                <div>
                  <Dialog.Title className="tv-team-sheet-title">Convite criado</Dialog.Title>
                  <Dialog.Description className="tv-team-sheet-description">
                    Copie agora. O link não será exibido novamente.
                  </Dialog.Description>
                </div>
              </div>

              {/* O aviso é texto, não só cor: quem não distingue o âmbar
                  precisa ler que isto é irrecuperável. */}
              <p className="tv-team-warning">
                <LuTriangleAlert aria-hidden="true" />
                <span>
                  O sistema guarda apenas uma marca deste link, e não consegue
                  reconstruí-lo. Se você fechar sem copiar, terá que emitir
                  outro convite.
                </span>
              </p>

              <div
                ref={invite.linkRef}
                className="tv-team-link"
                tabIndex={0}
                aria-label="Link do convite"
              >
                {invite.link}
              </div>

              {/* Foco aqui ao aparecer: o botão que gerou o link sumiu, e a
                  próxima ação é copiar. */}
              <button
                ref={copyRef}
                type="button"
                className="tv-team-copy"
                autoFocus
                onClick={invite.copy}
              >
                {invite.copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
                {invite.copied ? 'Link copiado' : 'Copiar link'}
              </button>

              <button
                type="button"
                className="tv-team-sheet-cta"
                disabled={!invite.copied && !invite.manualCopy}
                onClick={done}
              >
                Já copiei o link
                <LuArrowRight aria-hidden="true" />
              </button>
            </div>
          )}

          {invite.discard ? (
            <div
              className="tv-team-discard"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${ids}-discard`}
              aria-describedby={`${ids}-discard-text`}
            >
              <span aria-hidden="true">
                <LuTriangleAlert />
              </span>
              <h2 id={`${ids}-discard`}>Descartar link?</h2>
              <p id={`${ids}-discard-text`}>Esse link é exibido uma única vez.</p>
              <div>
                <button
                  type="button"
                  className="tv-team-discard-back"
                  autoFocus
                  onClick={backToLink}
                >
                  Voltar ao link
                </button>
                <button
                  type="button"
                  className="tv-team-discard-confirm"
                  onClick={() => setOpen(false)}
                >
                  Descartar
                </button>
              </div>
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
