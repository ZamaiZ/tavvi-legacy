'use client'

import { LuArrowRight, LuLock, LuMail } from 'react-icons/lu'
import { TavviField } from './tavvi-field'
import { useSignInForm } from './use-sign-in-form'

export function TavviSignInForm({
  next,
  denied = false,
  hint = 'Credenciais de administrador',
  emailPlaceholder = 'voce@tavvi.com',
  ctaLabel = 'Entrar no console',
  footer,
}: {
  next: string
  denied?: boolean
  hint?: string
  emailPlaceholder?: string
  ctaLabel?: string
  footer?: React.ReactNode
}) {
  const form = useSignInForm(denied)

  return (
    <form
      action={form.formAction}
      noValidate
      onSubmit={form.handleSubmit}
      className="tv-login-form flex w-full flex-col gap-4 rounded-tv-card border border-tv-border bg-tv-surface p-5 text-tv-text lg:gap-4 lg:p-6 lg:shadow-[var(--tv-card-shadow)]"
    >
      <input type="hidden" name="next" value={next} />

      {form.denialVisible ? (
        <div role="alert" className="tv-login-alert flex flex-col gap-2 rounded-tv-alert bg-tv-error-surface p-3 text-tv-error">
          <p className="text-[12.5px] leading-[17px] font-medium">Sua conta não tem permissão para acessar o console de administração.</p>
          <button
            type="button"
            onClick={form.dismissDenial}
            className="min-h-10 self-start rounded px-1 text-xs leading-4 font-semibold underline decoration-current underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-tv-ring"
          >
            Voltar ao formulário
          </button>
        </div>
      ) : null}

      {form.formError ? (
        <div role="alert" className="tv-login-alert rounded-tv-alert bg-tv-error-surface p-3 text-[12.5px] leading-[17px] font-medium text-tv-error">
          {form.formError}
        </div>
      ) : null}

      <div className="tv-login-head flex min-h-7 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-[22px] leading-[26px] font-extrabold tracking-[-0.66px]">Entrar</h2>
        <p className="text-xs leading-4 font-medium text-tv-subtle">{hint}</p>
      </div>

      <TavviField
        label="E-mail"
        name="email"
        type="email"
        value={form.email}
        onChange={form.editEmail}
        icon={LuMail}
        placeholder={emailPlaceholder}
        autoComplete="email"
        error={form.emailError}
        readOnly={form.busy}
        inputRef={form.emailRef}
      />

      <TavviField
        label="Senha"
        name="password"
        type="password"
        value={form.password}
        onChange={form.editPassword}
        icon={LuLock}
        placeholder="Sua senha"
        autoComplete="current-password"
        error={form.passwordError}
        readOnly={form.busy}
        inputRef={form.passwordRef}
        revealed={form.revealed}
        onToggleReveal={form.toggleReveal}
        capsLock={form.capsLock}
        onCapsLockChange={form.setCapsLock}
      />

      <button
        type="submit"
        disabled={!form.email || !form.password || form.busy}
        className="tv-login-submit group mt-1 flex h-9 w-full items-center justify-between rounded-tv-cta bg-[var(--tv-btn)] px-3 text-[var(--tv-btn-text)] outline-none transition-opacity duration-150 hover:opacity-80 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-tv-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-[13px] leading-5 font-medium">{form.busy ? 'Entrando…' : ctaLabel}</span>
        <span className="tv-login-submit-icon flex size-7 shrink-0 items-center justify-center rounded-md bg-tv-ink text-[var(--tv-gold-text)]">
          {form.busy ? (
            <span aria-label="Carregando" className="size-[18px] animate-spin rounded-full border-2 border-[var(--tv-gold-soft)] border-t-[var(--tv-gold-text)] motion-reduce:animate-none" />
          ) : (
            <LuArrowRight aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          )}
        </span>
      </button>

      {footer}
    </form>
  )
}
