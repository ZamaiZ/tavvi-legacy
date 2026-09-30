import type { Dispatch, SetStateAction } from 'react'
import type { UserSummary } from '@tavvi/api-contracts'

export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'

export type AuthContextValue = {
  status: AuthStatus
  user: UserSummary | null
  message: string | null
  dismissMessage(): void
  hasDeviceContract: boolean
  signIn(input: { email: string; password: string }): Promise<void>
  signInWithBiometrics(): Promise<void>
  enableBiometrics(): Promise<void>
  disableBiometrics(): Promise<void>
  signOut(): Promise<void>
  returnToForm(): void
}

export type AuthStateSetters = {
  setStatus: Dispatch<SetStateAction<AuthStatus>>
  setUser: Dispatch<SetStateAction<UserSummary | null>>
  setMessage: Dispatch<SetStateAction<string | null>>
}
