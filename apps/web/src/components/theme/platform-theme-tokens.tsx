import { ACCENT_PALETTES } from '@tavvi/theme-core'
import type { PropsWithChildren } from 'react'

const tokenNames = {
  accent: 'color', pressed: 'pressed', onAccent: 'on', textLight: 'text-light', textDark: 'text-dark',
  soft: 'soft', glow: 'glow', ctaGlow: 'cta-glow', heroGlow: 'hero-glow',
  focusLight: 'focus-light', focusDark: 'focus-dark', ring: 'ring',
  pill: 'pill', pillOn: 'pill-on', surface: 'surface',
} as const

function declarations(mode: 'light' | 'dark') {
  return Object.entries(tokenNames)
    .map(([key, suffix]) => {
      const paletteKey = key === 'focusLight' ? 'focus' : key === 'focusDark' ? 'focus' : key
      const tokenMode = key === 'focusLight' ? 'light' : key === 'focusDark' ? 'dark' : mode
      return `--tv-accent-${suffix}:${ACCENT_PALETTES[tokenMode][paletteKey as keyof typeof ACCENT_PALETTES.light]}`
    })
    .join(';')
}

const selectors = '.admin-territory,.tv-auth-scope,.workspace-territory'
const darkSelectors = selectors.split(',').map((selector) => `.dark ${selector}`).join(',')
const themeStyles = `${selectors}{${declarations('light')}}${darkSelectors}{${declarations('dark')}}`

export function PlatformThemeTokens({ children, className }: PropsWithChildren<{ className: string }>) {
  return <><style>{themeStyles}</style><div className={className}>{children}</div></>
}
