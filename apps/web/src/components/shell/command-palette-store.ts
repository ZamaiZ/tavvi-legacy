'use client'

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let open = false

export function setCommandPaletteOpen(next: boolean) {
  open = next
  listeners.forEach((listener) => listener())
}

export function useCommandPaletteOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => open,
    () => false,
  )
}
