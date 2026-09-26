'use client'

import { useId } from 'react'
import type { Ref } from 'react'
import type { IconType } from 'react-icons'
import { LuEye, LuEyeOff } from 'react-icons/lu'

type TavviFieldProps = {
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
}

export function TavviField({
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
}: TavviFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const capsId = `${id}-caps`
  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type

  function updateCapsLock(event: React.KeyboardEvent<HTMLInputElement>) {
    onCapsLockChange?.(event.getModifierState('CapsLock'))
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-4 items-center justify-between gap-2 px-1">
        <label htmlFor={id} className="text-xs leading-4 font-semibold text-tv-text">
          {label}
        </label>
        {isPassword && capsLock ? (
          <span id={capsId} className="rounded-tv-chip bg-tv-warn-surface px-2 py-1 text-[11px] leading-4 font-medium text-tv-warn">
            Caps Lock ativado
          </span>
        ) : null}
      </div>
      <div className={`group flex min-h-[54px] items-center gap-3 rounded-tv-field border bg-tv-field pl-4 pr-2 transition-[border-color,box-shadow,background-color] duration-200 focus-within:ring-4 focus-within:ring-tv-ring ${error ? 'border-tv-error' : 'border-tv-border focus-within:border-tv-focus'}`}>
        <Icon aria-hidden="true" className={`size-[18px] shrink-0 transition-colors duration-150 ${error ? 'text-tv-error' : 'text-tv-subtle group-focus-within:text-tv-focus'}`} strokeWidth={1.7} />
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          readOnly={readOnly}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={[error ? errorId : '', isPassword && capsLock ? capsId : ''].filter(Boolean).join(' ') || undefined}
          onKeyDown={isPassword ? updateCapsLock : undefined}
          onKeyUp={isPassword ? updateCapsLock : undefined}
          onBlur={isPassword ? () => onCapsLockChange?.(false) : undefined}
          className="tv-login-input min-w-0 flex-1 bg-transparent py-3 text-[14.5px] leading-5 font-medium text-tv-text outline-none placeholder:text-tv-subtle read-only:opacity-70"
        />
        {isPassword && onToggleReveal ? (
          <button
            type="button"
            onClick={onToggleReveal}
            disabled={readOnly}
            aria-label={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="flex size-11 shrink-0 items-center justify-center rounded-tv-button text-tv-subtle outline-none transition-colors hover:bg-[var(--tv-hover)] hover:text-tv-text focus-visible:ring-4 focus-visible:ring-tv-ring disabled:opacity-50"
          >
            {revealed
              ? <LuEyeOff aria-hidden="true" className="size-[18px]" strokeWidth={1.7} />
              : <LuEye aria-hidden="true" className="size-[18px]" strokeWidth={1.7} />}
          </button>
        ) : null}
      </div>
      {error ? <p id={errorId} role="alert" className="px-1 text-xs leading-4 font-medium text-tv-error">{error}</p> : null}
    </div>
  )
}
