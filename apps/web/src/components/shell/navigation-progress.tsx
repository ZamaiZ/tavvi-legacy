'use client'

import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const NavigateContext = createContext<((href: string) => void) | null>(null)

export function NavigationProgress({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const navigate = useCallback((href: string) => {
    startTransition(() => router.push(href))
  }, [router])

  return (
    <NavigateContext.Provider value={navigate}>
      <div className="tv-nav-progress" data-active={pending || undefined} aria-hidden="true" />
      {pending ? <span className="sr-only" role="status">Carregando a página…</span> : null}
      {children}
    </NavigateContext.Provider>
  )
}

export function useProgressNavigate(): (href: string) => void {
  const navigate = useContext(NavigateContext)
  const router = useRouter()
  return navigate ?? ((href) => router.push(href))
}
