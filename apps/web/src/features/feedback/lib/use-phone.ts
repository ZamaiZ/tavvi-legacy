import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function subscribe(callback: () => void) {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

// Detalhe em MobileSheet no celular e em Dialog no desktop. O servidor
// renderiza como desktop; o cliente corrige na hidratação.
export function usePhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
