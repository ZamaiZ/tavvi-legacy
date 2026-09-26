import * as SystemUI from 'expo-system-ui'
import { StatusBar } from 'expo-status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { VariableContextProvider } from 'react-native-css'
import { secureStoreAdapter } from '@/lib/secure-store-adapter'
import { API_ROUTES, platformAppearanceSchema, type PlatformAppearance } from '@tavvi/api-contracts'
import { DEFAULT_APPEARANCE, PALETTE_SCHEMA_VERSION, derivePlatformPalette } from '@tavvi/theme-core'
import { publicApiRequest } from '@/lib/api-client'

import { palettes, type AppColors } from './tokens'

const STORAGE_KEY = 'tavvi.theme.preference'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type AppThemeValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  colors: AppColors
  setPreference(next: ThemePreference): Promise<void>
  appearance: PlatformAppearance
  setPlatformAppearance(next: PlatformAppearance): void
  hydrated: boolean
}

const ThemeContext = createContext<AppThemeValue | null>(null)

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme()
  const [preference, setStoredPreference] = useState<ThemePreference>('system')
  const [appearance, setPlatformAppearance] = useState<PlatformAppearance>(() => ({ source: DEFAULT_APPEARANCE, schemaVersion: PALETTE_SCHEMA_VERSION, palette: derivePlatformPalette(DEFAULT_APPEARANCE), updatedAt: new Date(0).toISOString() }))
  const [hydrated, setHydrated] = useState(false)
  const resolved: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference
  const accent = appearance.palette[resolved]
  const colors: AppColors = {
    ...palettes[resolved],
    accent: accent.accent,
    accentPressed: accent['accent-pressed'],
    accentOn: accent['accent-on'],
    accentTextLight: accent['accent-text-light'],
    accentTextDark: accent['accent-text-dark'],
    accentText: resolved === 'light' ? accent['accent-text-light'] : accent['accent-text-dark'],
    accentSoft: accent['accent-soft'],
    accentGlow: accent['accent-glow'],
    accentCtaGlow: accent['accent-cta-glow'],
    accentHeroGlow: accent['accent-hero-glow'],
    accentFocus: accent['accent-focus'],
    accentRing: accent['accent-ring'],
    accentPill: accent['accent-pill'],
    accentPillOn: accent['accent-pill-on'],
    accentSurface: accent['accent-surface'],
  }

  useEffect(() => {
    let active = true
    void publicApiRequest<unknown>(API_ROUTES.platform.appearance).then((value) => {
      const parsed = platformAppearanceSchema.safeParse(value)
      if (active && parsed.success && parsed.data.schemaVersion === PALETTE_SCHEMA_VERSION) setPlatformAppearance(parsed.data)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    secureStoreAdapter.getItem(STORAGE_KEY).then((value) => {
      if (value === 'light' || value === 'dark') {
        setStoredPreference(value)
        Appearance.setColorScheme(value)
      } else Appearance.setColorScheme('unspecified')
    }).finally(() => setHydrated(true))
  }, [])

  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.background) }, [colors.background])

  const setPreference = useCallback(async (next: ThemePreference) => {
    setStoredPreference(next)
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next)
    await secureStoreAdapter.setItem(STORAGE_KEY, next)
  }, [])

  const value = useMemo<AppThemeValue>(() => ({ preference, resolved, colors, setPreference, appearance, setPlatformAppearance, hydrated }), [appearance, colors, hydrated, preference, resolved, setPreference])
  const variables = useMemo(() => ({
    '--background': colors.background, '--foreground': colors.foreground, '--surface': colors.surface, '--field': colors.field,
    '--surface-2': colors.surface, '--surface-3': colors.field,
    '--primary': colors.accent, '--primary-foreground': colors.accentOn, '--secondary': colors.surface,
    '--secondary-foreground': colors.foreground, '--muted': colors.field, '--muted-foreground': colors.muted,
    '--accent': colors.accentSurface, '--accent-foreground': colors.accentText, '--destructive': colors.dangerText,
    '--border': colors.line, '--input': colors.line, '--ring': colors.accentFocus,
    '--subtle': colors.subtle, '--line': colors.line, '--line-2': colors.line2,
  }), [colors])

  return (
    <ThemeContext.Provider value={value}>
      <VariableContextProvider value={variables}>
        <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
        {children}
      </VariableContextProvider>
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useAppTheme deve ser usado dentro de AppThemeProvider')
  return value
}
