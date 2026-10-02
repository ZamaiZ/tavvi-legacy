'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Cada tela dá o próprio recuo e largura (console-page.css, console-login.css),
// então o template não envolve o conteúdo em nada.
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.tv-console-main h1, .tv-account-page h1')?.focus())
  }, [pathname])
  return <>{children}</>
}
