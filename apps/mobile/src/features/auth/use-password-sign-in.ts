import { useCallback } from 'react'
import { API_ROUTES, type AuthSession, type DeviceContractStatus } from '@tavvi/api-contracts'
import { apiRequest, publicApiRequest } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/lib/session-store'
import type { AuthStateSetters } from './auth-types'
import { inspectBiometricSupport, type AvailableBiometric } from './biometric-support'
import { deviceContractStore } from './device-contract-store'

type UsePasswordSignInInput = AuthStateSetters & {
  setHasDeviceContract(value: boolean): void
  setBiometricOffer(offer: AvailableBiometric | null): void
}

// Login com senha não ativa nada sozinho (spec 2026-10-01): se a digital não
// estiver ativa neste aparelho, liga a oferta e o diálogo pergunta.
export function usePasswordSignIn({ setStatus, setUser, setMessage, setHasDeviceContract, setBiometricOffer }: UsePasswordSignInInput) {
  return useCallback(async (input: { email: string; password: string }) => {
    const session = await publicApiRequest<AuthSession>(API_ROUTES.auth.login, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    await sessionStore.set(session)
    queryClient.clear()
    setUser(session.user)
    setMessage(null)
    setStatus('authenticated')

    const metadata = await deviceContractStore.getMetadata().catch(() => null)
    if (metadata?.registered) {
      // "Sair de todos" e troca de senha revogam no servidor sem o aparelho
      // saber. Sem resposta (rede), fica como está.
      const remote = await apiRequest<DeviceContractStatus>(API_ROUTES.auth.deviceContractStatus(metadata.deviceId)).catch(() => null)
      if (!remote || remote.active) return
      await deviceContractStore.deactivate().catch(() => undefined)
      setHasDeviceContract(false)
    }
    const support = await inspectBiometricSupport().catch(() => null)
    if (support?.available) setBiometricOffer(support)
  }, [setBiometricOffer, setHasDeviceContract, setMessage, setStatus, setUser])
}
