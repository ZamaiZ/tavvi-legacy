import type { LocalAuthenticationError } from 'expo-local-authentication'

export const LOCKOUT_MESSAGE = 'O celular bloqueou a biometria depois de muitas tentativas. Desbloqueie o celular com a senha dele e tente de novo, ou entre com e-mail e senha.'

export type LocalBiometricFailure = 'cancelled' | 'lockout' | 'other'

// O expo-secure-store não expõe código, só a mensagem nativa: "User
// canceled…" vem do Android e do iOS; "Lockout"/"Lockout permanent", do Android.
export function classifySecureStoreError(error: unknown): LocalBiometricFailure {
  const message = describeError(error)
  if (/cancel/i.test(message)) return 'cancelled'
  if (/lockout/i.test(message)) return 'lockout'
  return 'other'
}

export function classifyLocalAuthError(error: LocalAuthenticationError): LocalBiometricFailure {
  if (error === 'user_cancel' || error === 'system_cancel' || error === 'app_cancel' || error === 'user_fallback') return 'cancelled'
  if (error === 'lockout') return 'lockout'
  return 'other'
}

export function describeError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error)
}
