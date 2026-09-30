'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(hover: hover) and (pointer: fine) and (min-width: 768px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// Mouse de verdade numa tela larga. No servidor e no primeiro render, falso:
// o menu de contexto só liga depois de montar, e o toque nunca o vê.
export function useFinePointer() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
