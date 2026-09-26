'use client'

import { useSyncExternalStore } from 'react'

export type RailMode = 'collapsed' | 'pinned'

let railMode: RailMode = typeof document !== 'undefined' && /(?:^|;\s*)tv_rail=pinned(?:;|$)/.test(document.cookie)
  ? 'pinned'
  : 'collapsed'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return railMode
}

function notify() {
  listeners.forEach((listener) => listener())
}

export function setRailMode(mode: RailMode) {
  railMode = mode
  if (typeof document !== 'undefined') {
    document.cookie = `tv_rail=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`
  }
  notify()
}

export function toggleRailMode() {
  setRailMode(railMode === 'pinned' ? 'collapsed' : 'pinned')
}

export function useRailMode(initialMode: RailMode) {
  return useSyncExternalStore(subscribe, getSnapshot, () => initialMode)
}
