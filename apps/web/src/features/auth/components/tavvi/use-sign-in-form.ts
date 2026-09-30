'use client'

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { signInAction } from '@/server/actions/auth'

const EMAIL_ERROR = 'Informe um e-mail válido.'
const SERVER_EMAIL_ERROR = 'Informe um e-mail válido'

// Estado do formulário de entrada, compartilhado pelo login do console e do
// painel. Depois do sucesso a navegação é de documento inteiro (ver
// signInAction) e o formulário continua ocupado até a página sair.
export function useSignInForm(denied: boolean) {
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

  useEffect(() => {
    if (state?.ok) window.location.replace(state.data.next)
  }, [state])

  const busy = pending || state?.ok === true
  const serverError = state && !state.ok && !pending && !serverErrorDismissed ? state.error : ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (busy) {
      event.preventDefault()
      return
    }
    const isEmailValid = /^\S+@\S+\.\S+$/.test(email)
    setEmailError(isEmailValid ? '' : EMAIL_ERROR)
    setPasswordError(password ? '' : 'Informe sua senha.')
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

  return {
    formAction,
    busy,
    email,
    password,
    editEmail,
    editPassword,
    emailError: emailError || (serverError === SERVER_EMAIL_ERROR ? EMAIL_ERROR : ''),
    passwordError,
    formError: serverError && serverError !== SERVER_EMAIL_ERROR ? serverError : '',
    denialVisible,
    dismissDenial: () => setDenialVisible(false),
    revealed,
    toggleReveal: () => setRevealed((current) => !current),
    capsLock,
    setCapsLock,
    emailRef,
    passwordRef,
    handleSubmit,
  }
}
