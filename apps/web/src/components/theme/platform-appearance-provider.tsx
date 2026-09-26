'use client'

import { createContext, useContext, useMemo, useState, type CSSProperties, type PropsWithChildren } from 'react'
import type { PlatformAppearance } from '@tavvi/api-contracts'

type AppearanceContextValue = { appearance: PlatformAppearance; applyAppearance(value: PlatformAppearance): void }
const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function cssVariables(appearance: PlatformAppearance): CSSProperties {
  const light = appearance.palette.light
  const dark = appearance.palette.dark
  return {
    '--tv-accent-color': light.accent,
    '--tv-accent-pressed': light['accent-pressed'],
    '--tv-accent-on': light['accent-on'],
    '--tv-accent-text-light': light['accent-text-light'],
    '--tv-accent-text-dark': dark['accent-text-dark'],
    '--tv-accent-soft': light['accent-soft'],
    '--tv-accent-glow': light['accent-glow'],
    '--tv-accent-cta-glow': light['accent-cta-glow'],
    '--tv-accent-hero-glow': dark['accent-hero-glow'],
    '--tv-accent-focus-light': light['accent-focus'],
    '--tv-accent-focus-dark': dark['accent-focus'],
    '--tv-accent-ring': dark['accent-ring'],
    '--tv-accent-pill-light': light['accent-pill'],
    '--tv-accent-pill-on-light': light['accent-pill-on'],
    '--tv-accent-pill-dark': dark['accent-pill'],
    '--tv-accent-pill-on-dark': dark['accent-pill-on'],
    '--tv-accent-surface': light['accent-surface'],
  } as CSSProperties
}

export function PlatformAppearanceProvider({ initialAppearance, className, children }: PropsWithChildren<{ initialAppearance: PlatformAppearance; className: string }>) {
  const [appearance, applyAppearance] = useState(initialAppearance)
  const value = useMemo(() => ({ appearance, applyAppearance }), [appearance])
  return <AppearanceContext.Provider value={value}><div className={className} style={cssVariables(appearance)}>{children}</div></AppearanceContext.Provider>
}

export function usePlatformAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('usePlatformAppearance deve ser usado dentro de PlatformAppearanceProvider')
  return value
}
