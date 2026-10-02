'use client'

const STORAGE_KEY = 'tavvi:service-call-sound'
let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  try { context ??= new window.AudioContext(); return context } catch { return null }
}

export function isServiceCallSoundEnabled(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'on' } catch { return false }
}

function tone() {
  try {
    const audio = audioContext()
    if (!audio || audio.state !== 'running') return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(740, audio.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(520, audio.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.14, audio.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.22)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + 0.23)
  } catch { /* Audio bloqueado não interfere com a central nem com a fila. */ }
}

export async function enableServiceCallSoundFromGesture(): Promise<boolean> {
  try {
    const audio = audioContext()
    if (!audio) return false
    await audio.resume()
    if (audio.state !== 'running') return false
    window.localStorage.setItem(STORAGE_KEY, 'on')
    tone()
    return true
  } catch { return false }
}

export function disableServiceCallSound() {
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* Preferência apenas local. */ }
}

export function playServiceCallSoundIfEnabled() {
  if (isServiceCallSoundEnabled()) tone()
}
