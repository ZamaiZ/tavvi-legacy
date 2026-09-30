'use client'

import { useEffect, useRef, useState } from 'react'
import { LuMonitor, LuMoon, LuSun } from 'react-icons/lu'
import { useReducedMotion } from 'motion/react'
import { useTheme, type Theme } from '@/components/theme/theme-provider'

const LABELS: Record<Theme, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
}

const ICONS = {
  system: LuMonitor,
  light: LuSun,
  dark: LuMoon,
}

function nextTheme(theme: Theme): Theme {
  if (theme === 'system') return 'light'
  if (theme === 'light') return 'dark'
  return 'system'
}

export function HeroThemeToggle({ hideBelowLg = false }: { hideBelowLg?: boolean }) {
  const { theme, setTheme } = useTheme()
  const reducedMotion = useReducedMotion()
  const [turn, setTurn] = useState(0)
  const [notice, setNotice] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const Icon = ICONS[theme]

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function toggle() {
    const next = nextTheme(theme)
    setTheme(next)
    setTurn((value) => value + 1)
    const systemLabel = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'Sistema · Escuro'
      : 'Sistema · Claro'
    setNotice(next === 'system' ? systemLabel : LABELS[next])
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNotice(''), 1500)
  }

  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-[62px] top-3 hidden h-8 items-center rounded-xl border border-tv-border bg-tv-surface px-3 text-xs font-medium text-tv-text shadow-[var(--tv-card-shadow)] transition-[opacity,transform,background-color] duration-300 motion-reduce:transition-none lg:flex ${notice ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'}`}
      >
        {notice}
      </span>
      <span aria-live="polite" className="sr-only">{notice}</span>
      <button
        type="button"
        onClick={toggle}
        aria-label="Alternar tema"
        aria-description={`Preferência atual: ${LABELS[theme]}`}
        className={`absolute top-[max(24px,calc(env(safe-area-inset-top)+12px))] right-6 z-20 flex size-[54px] items-center justify-center rounded-tv-toggle border border-[var(--tv-toggle-line)] bg-tv-surface text-tv-text outline-none transition-colors duration-150 hover:bg-[var(--tv-hover)] focus-visible:ring-4 focus-visible:ring-tv-ring motion-reduce:transition-none lg:top-0 lg:right-0${hideBelowLg ? ' max-lg:hidden' : ''}`}
      >
        <span
          aria-hidden="true"
          className="flex size-[19px] items-center justify-center"
          style={{
            transform: `rotate(${turn * 360}deg)`,
            transition: reducedMotion ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Icon className="size-[19px]" />
        </span>
      </button>
    </>
  )
}
