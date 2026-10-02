import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { inspectBiometricSupport, type BiometricKind } from './biometric-support'

export type { BiometricKind } from './biometric-support'

export type BiometricAvailability =
  | { state: 'checking' }
  | { state: 'available'; kind: BiometricKind; label: string }
  | { state: 'unavailable'; reason: string }

// Verifica de novo quando o app volta: a pessoa pode ter cadastrado uma
// digital nas configurações do celular nesse meio-tempo.
export function useBiometricAvailability(): BiometricAvailability {
  const [availability, setAvailability] = useState<BiometricAvailability>({ state: 'checking' })

  useEffect(() => {
    let active = true
    async function inspect() {
      try {
        const support = await inspectBiometricSupport()
        if (!active) return
        setAvailability(support.available
          ? { state: 'available', kind: support.kind, label: support.label }
          : { state: 'unavailable', reason: support.reason })
      } catch {
        if (active) setAvailability({ state: 'unavailable', reason: 'Não foi possível verificar a biometria deste celular.' })
      }
    }
    void inspect()
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void inspect()
    })
    return () => {
      active = false
      listener.remove()
    }
  }, [])

  return availability
}
