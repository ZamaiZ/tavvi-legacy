'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tema'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Janela privada: o acesso lanca. Cair no padrao e o comportamento
    // correto -- a interface continua utilizavel, so nao lembra a escolha.
  }
  return 'system'
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable
  )
}

function nextTheme(theme: Theme): Theme {
  if (theme === 'system') return 'light'
  if (theme === 'light') return 'dark'
  return 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Comeca em 'system' no servidor e no primeiro render do cliente, para que
  // o HTML dos dois lados coincida. A leitura real do localStorage acontece
  // no efeito abaixo -- o script embutido ja aplicou a classe antes disso.
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    setThemeState(readStoredTheme())
  }, [])

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system') return

    // Seguindo o sistema, precisamos reagir quando ele muda -- alguem
    // alternando o modo escuro do celular ao anoitecer, por exemplo.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sem persistencia em janela privada. A escolha vale para a sessao.
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditableTarget(event.target)) return
      const altGraph = event.getModifierState('AltGraph')
      const matches =
        event.code === 'KeyT' &&
        event.altKey &&
        (event.ctrlKey || altGraph)
      if (!matches) return
      event.preventDefault()
      setTheme(nextTheme(theme))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTheme, theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme precisa estar dentro de ThemeProvider')
  }
  return context
}
