'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'tavvi:sidebar:collapsed'
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function getSidebarCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  } catch {
    // O estado ainda funciona nesta sessão, embora não possa ser persistido.
  }
  emit()
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed(!getSidebarCollapsed())
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(subscribe, getSidebarCollapsed, () => false)
}
