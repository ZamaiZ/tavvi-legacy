'use client'

import { LuArrowRight, LuLock, LuMail } from 'react-icons/lu'
import { ConsoleField } from './console-field'
import { useSignInForm } from './use-sign-in-form'

// Formulário do login do console (Tavvi Web.dc.html): sem cartão no desktop,
// CTA em pílula com opacidade .45 até os dois campos terem valor.
export function ConsoleSignInForm({ next, denied = false }: { next: string; denied?: boolean }) {
  const form = useSignInForm(denied)
  const ready = Boolean(form.email && form.password)

  return (
    <form action={form.formAction} noValidate onSubmit={form.handleSubmit} className="tv-cl-form">
      <input type="hidden" name="next" value={next} />

      <div className="tv-cl-head">
        <h2>Entrar</h2>
        <p>Credenciais de administrador</p>
      </div>

      {form.denialVisible ? (
        <div role="alert" className="tv-cl-alert">
          <p>Sua conta não tem permissão para acessar o console de administração.</p>
          <button type="button" onClick={form.dismissDenial}>Voltar ao formulário</button>
        </div>
      ) : null}

      {form.formError ? <div role="alert" className="tv-cl-alert">{form.formError}</div> : null}

      <ConsoleField
        label="E-mail"
        name="email"
        type="email"
        value={form.email}
        onChange={form.editEmail}
        icon={LuMail}
        placeholder="voce@tavvi.com"
        autoComplete="email"
        error={form.emailError}
        readOnly={form.busy}
        inputRef={form.emailRef}
      />

      <ConsoleField
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

      <button type="submit" disabled={!ready || form.busy} data-busy={form.busy} className="tv-cl-submit">
        {form.busy
          ? <><span aria-hidden="true" className="tv-cl-spinner" />Entrando…</>
          : <>Entrar no console<LuArrowRight aria-hidden="true" /></>}
      </button>

      <p className="tv-cl-footnote">Protegido por sessão segura · Tavvi</p>
    </form>
  )
}
