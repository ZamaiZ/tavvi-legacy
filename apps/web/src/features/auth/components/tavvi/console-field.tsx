'use client'

import { useId, type KeyboardEvent, type Ref } from 'react'
import type { IconType } from 'react-icons'
import { LuEye, LuEyeOff } from 'react-icons/lu'

// Campo do login do console. As medidas mudam por largura em
// console-login.css: 34 px no desktop, 48 px na tela escura do celular.
export function ConsoleField({
  label,
  name,
  type,
  value,
  onChange,
  icon: Icon,
  placeholder,
  autoComplete,
  error,
  readOnly = false,
  revealed = false,
  onToggleReveal,
  capsLock = false,
  onCapsLockChange,
  inputRef,
}: {
  label: string
  name: string
  type: 'email' | 'password'
  value: string
  onChange(value: string): void
  icon: IconType
  placeholder: string
  autoComplete: string
  error?: string
  readOnly?: boolean
  revealed?: boolean
  onToggleReveal?(): void
  capsLock?: boolean
  onCapsLockChange?(active: boolean): void
  inputRef?: Ref<HTMLInputElement>
}) {
  const id = useId()
  const errorId = `${id}-error`
  const capsId = `${id}-caps`
  const isPassword = type === 'password'
  const showCaps = isPassword && capsLock

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    onCapsLockChange?.(event.getModifierState('CapsLock'))
  }

  return (
    <div className="tv-cl-field">
      <div className="tv-cl-label">
        <label htmlFor={id}>{label}</label>
        {showCaps ? <span id={capsId} className="tv-cl-caps">Caps Lock ativado</span> : null}
      </div>
      <div className={`tv-cl-box${error ? ' is-invalid' : ''}`}>
        <Icon aria-hidden="true" className="tv-cl-icon" />
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={[error ? errorId : '', showCaps ? capsId : ''].filter(Boolean).join(' ') || undefined}
          onKeyDown={isPassword ? updateCapsLock : undefined}
          onKeyUp={isPassword ? updateCapsLock : undefined}
          onBlur={isPassword ? () => onCapsLockChange?.(false) : undefined}
          className="tv-cl-input"
        />
        {isPassword && onToggleReveal ? (
          <button
            type="button"
            onClick={onToggleReveal}
            disabled={readOnly}
            aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="tv-cl-reveal"
          >
            {revealed ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? <p id={errorId} role="alert" className="tv-cl-error">{error}</p> : null}
    </div>
  )
}
