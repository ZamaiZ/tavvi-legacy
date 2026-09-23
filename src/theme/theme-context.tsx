import * as SystemUI from 'expo-system-ui'
import { StatusBar } from 'expo-status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { VariableContextProvider } from 'react-native-css'
import { secureStoreAdapter } from '@/lib/secure-store-adapter'

import { palettes } from './tokens'

const STORAGE_KEY = 'tavvi.theme.preference'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type AppThemeValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  colors: (typeof palettes)[ResolvedTheme]
  setPreference(next: ThemePreference): Promise<void>
  hydrated: boolean
}

const ThemeContext = createContext<AppThemeValue | null>(null)

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme()
  const [preference, setStoredPreference] = useState<ThemePreference>('system')
  const [hydrated, setHydrated] = useState(false)
  const resolved: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference
  const colors = palettes[resolved]

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

  const value = useMemo<AppThemeValue>(() => ({ preference, resolved, colors, setPreference, hydrated }), [colors, hydrated, preference, resolved, setPreference])
  const variables = useMemo(() => ({
    '--background': colors.background, '--foreground': colors.foreground, '--surface': colors.surface, '--field': colors.field,
    '--surface-2': colors.surface, '--surface-3': colors.field,
    '--primary': colors.accentText, '--primary-foreground': '#0A0C09', '--secondary': colors.surface,
    '--secondary-foreground': colors.foreground, '--muted': colors.field, '--muted-foreground': colors.muted,
    '--accent': colors.accentSurface, '--accent-foreground': colors.foreground, '--destructive': colors.dangerText,
    '--border': colors.line, '--input': colors.line, '--ring': colors.accentText,
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
