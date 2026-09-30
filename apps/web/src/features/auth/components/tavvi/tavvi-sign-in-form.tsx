'use client'

import { useActionState, useRef, useState } from 'react'
import { LuArrowRight, LuLock, LuMail } from 'react-icons/lu'
import { signInAction } from '@/server/actions/auth'
import { TavviField } from './tavvi-field'

const EMAIL_ERROR = 'Informe um e-mail válido.'
const SERVER_EMAIL_ERROR = 'Informe um e-mail válido'

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
  const [state, formAction, pending] = useActionState(signInAction, undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [denialVisible, setDenialVisible] = useState(denied)
  const [serverErrorDismissed, setServerErrorDismissed] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const serverError = state && !state.ok && !pending && !serverErrorDismissed ? state.error : ''
  const inlineServerEmailError = serverError === SERVER_EMAIL_ERROR ? EMAIL_ERROR : ''
  const formError = serverError && serverError !== SERVER_EMAIL_ERROR ? serverError : ''

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const isEmailValid = /^\S+@\S+\.\S+$/.test(email)
    const nextEmailError = isEmailValid ? '' : EMAIL_ERROR
    const nextPasswordError = password ? '' : 'Informe sua senha.'

    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setServerErrorDismissed(false)

    if (!isEmailValid || !password) {
      event.preventDefault()
      if (!isEmailValid) emailRef.current?.focus()
      else passwordRef.current?.focus()
    }
  }

  function editEmail(value: string) {
    setEmail(value)
    setEmailError('')
    setDenialVisible(false)
    setServerErrorDismissed(true)
  }

  function editPassword(value: string) {
    setPassword(value)
    setPasswordError('')
    setDenialVisible(false)
    setServerErrorDismissed(true)
  }

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 rounded-tv-card border border-tv-border bg-tv-surface p-5 text-tv-text lg:gap-4 lg:p-6 lg:shadow-[var(--tv-card-shadow)]"
    >
      <input type="hidden" name="next" value={next} />

      {denialVisible ? (
        <div role="alert" className="flex flex-col gap-2 rounded-tv-alert bg-tv-error-surface p-3 text-tv-error">
          <p className="text-[12.5px] leading-[17px] font-medium">Sua conta não tem permissão para acessar o console de administração.</p>
          <button
            type="button"
            onClick={() => setDenialVisible(false)}
            className="min-h-10 self-start rounded px-1 text-xs leading-4 font-semibold underline decoration-current underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-tv-ring"
          >
            Voltar ao formulário
          </button>
        </div>
      ) : null}

      {formError ? (
        <div role="alert" className="rounded-tv-alert bg-tv-error-surface p-3 text-[12.5px] leading-[17px] font-medium text-tv-error">
          {formError}
        </div>
      ) : null}

      <div className="flex min-h-7 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-[22px] leading-[26px] font-extrabold tracking-[-0.66px]">Entrar</h2>
        <p className="text-xs leading-4 font-medium text-tv-subtle">{hint}</p>
      </div>

      <TavviField
        label="E-mail"
        name="email"
        type="email"
        value={email}
        onChange={editEmail}
        icon={LuMail}
        placeholder={emailPlaceholder}
        autoComplete="email"
        error={emailError || inlineServerEmailError}
        readOnly={pending}
        inputRef={emailRef}
      />

      <TavviField
        label="Senha"
        name="password"
        type="password"
        value={password}
        onChange={editPassword}
        icon={LuLock}
        placeholder="Sua senha"
        autoComplete="current-password"
        error={passwordError}
        readOnly={pending}
        inputRef={passwordRef}
        revealed={revealed}
        onToggleReveal={() => setRevealed((current) => !current)}
        capsLock={capsLock}
        onCapsLockChange={setCapsLock}
      />

      <button
        type="submit"
        disabled={!email || !password || pending}
        className="group mt-1 flex h-9 w-full items-center justify-between rounded-tv-cta bg-[var(--tv-btn)] px-3 text-[var(--tv-btn-text)] outline-none transition-opacity duration-150 hover:opacity-80 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-tv-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-[13px] leading-5 font-medium">{pending ? 'Entrando…' : ctaLabel}</span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-tv-ink text-[var(--tv-gold-text)]">
          {pending ? (
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
