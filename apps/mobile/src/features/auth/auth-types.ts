import type { Dispatch, SetStateAction } from 'react'
import type { UserSummary } from '@tavvi/api-contracts'
import type { AvailableBiometric } from './biometric-support'

export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'

export type AuthContextValue = {
  status: AuthStatus
  user: UserSummary | null
  message: string | null
  dismissMessage(): void
  hasDeviceContract: boolean
  /** Oferta de ativar a digital depois do login com senha; null = sem oferta. */
  biometricOffer: AvailableBiometric | null
  signIn(input: { email: string; password: string }): Promise<void>
  signInWithBiometrics(): Promise<void>
  acceptBiometricOffer(): Promise<'enabled' | 'cancelled'>
  dismissBiometricOffer(): void
  disableBiometrics(): Promise<'disabled' | 'cancelled'>
  signOut(): Promise<void>
  signOutEverywhere(): Promise<void>
  returnToForm(): void
}

export type AuthStateSetters = {
  setStatus: Dispatch<SetStateAction<AuthStatus>>
  setUser: Dispatch<SetStateAction<UserSummary | null>>
  setMessage: Dispatch<SetStateAction<string | null>>
}
