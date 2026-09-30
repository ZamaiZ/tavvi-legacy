'use client'

import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// O tema do painel mora na classe `dark` do <html> (ThemeScript/ThemeProvider).
export function useDocumentDark(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'), () => false)
}
