import { isRunningInExpoGo } from 'expo'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { LOCKOUT_MESSAGE } from './biometric-errors'

export type BiometricKind = 'face' | 'fingerprint' | 'biometric'

export type AvailableBiometric = {
  available: true
  kind: BiometricKind
  /** Nome no botão: "Entrar com Impressão digital". */
  label: string
  /** Com artigo, para frases: "Entrar com a digital da próxima vez?". */
  phrase: string
  /** Toast depois de ativar. */
  activated: string
}

export type BiometricSupport = AvailableBiometric | { available: false; reason: string }

function fingerprint(ios: boolean): AvailableBiometric {
  return ios
    ? { available: true, kind: 'fingerprint', label: 'Touch ID', phrase: 'o Touch ID', activated: 'Touch ID ativado' }
    : { available: true, kind: 'fingerprint', label: 'Impressão digital', phrase: 'a digital', activated: 'Digital ativada' }
}

function face(ios: boolean): AvailableBiometric {
  return ios
    ? { available: true, kind: 'face', label: 'Face ID', phrase: 'o Face ID', activated: 'Face ID ativado' }
    : { available: true, kind: 'face', label: 'Reconhecimento facial', phrase: 'o reconhecimento facial', activated: 'Reconhecimento facial ativado' }
}

// Única checagem de biometria do app: o botão da tela de login e a oferta de
// ativação usam esta função, e o motivo aparece para a pessoa como está.
export async function inspectBiometricSupport(): Promise<BiometricSupport> {
  if (process.env.EXPO_OS === 'web') return { available: false, reason: 'A digital só funciona no aplicativo do celular.' }
  const ios = process.env.EXPO_OS === 'ios'
  // O Expo Go do iPhone não tem NSFaceIDUsageDescription, e o SecureStore
  // recusa requireAuthentication lá (docs SDK 57). isRunningInExpoGo, e não
  // executionEnvironment: 'storeClient' também vale para o development build.
  if (ios && isRunningInExpoGo()) {
    return { available: false, reason: 'A digital não funciona no Expo Go do iPhone. Use o development build.' }
  }

  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ])
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  if (!hardware) {
    // No iPhone, Face ID negado para o app chega como "sem hardware"; o tipo
    // do aparelho continua visível.
    if (ios && hasFace) return { available: false, reason: 'Permita o Face ID para a Tavvi nos Ajustes do iPhone.' }
    return { available: false, reason: 'Este celular não tem leitor de digital ou de rosto compatível.' }
  }
  if (!enrolled) {
    const reason = ios && hasFace
      ? 'Cadastre o Face ID nos Ajustes do iPhone.'
      : ios && hasFingerprint
        ? 'Cadastre uma digital no Touch ID, nos Ajustes do iPhone.'
        : 'Cadastre uma digital nas configurações do celular.'
    return { available: false, reason }
  }
  if (!SecureStore.canUseBiometricAuthentication()) {
    // No iPhone, isEnrolledAsync diz "cadastrado" com a biometria bloqueada
    // por tentativas, e só nesse caso o SecureStore recusa depois dele.
    if (ios) return { available: false, reason: LOCKOUT_MESSAGE }
    return { available: false, reason: 'A biometria cadastrada neste celular não é forte o bastante para proteger o acesso. Cadastre uma digital nas configurações do celular.' }
  }
  // No Android, o SecureStore só aceita biometria forte (classe 3); o rosto
  // pela câmera costuma ser classe 2, então a digital vem primeiro.
  if (ios) {
    if (hasFace) return face(true)
    if (hasFingerprint) return fingerprint(true)
  } else {
    if (hasFingerprint) return fingerprint(false)
    if (hasFace) return face(false)
  }
  return { available: true, kind: 'biometric', label: 'Biometria', phrase: 'a biometria', activated: 'Biometria ativada' }
}
