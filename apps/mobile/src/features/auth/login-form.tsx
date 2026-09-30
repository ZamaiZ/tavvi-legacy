import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { ArrowRight, Lock, Mail } from 'lucide-react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { AppText } from '@/components/primitives/app-text'
import type { AuthContextValue } from './auth-context'
import { BiometricButton } from './biometric-button'
import { LoginField } from './login-field'
import type { LoginPalette } from './login-theme'

type LoginFormProps = {
  palette: LoginPalette
  signIn: AuthContextValue['signIn']
  signInWithBiometrics: AuthContextValue['signInWithBiometrics']
  disableBiometrics: AuthContextValue['disableBiometrics']
  hasDeviceContract: boolean
  authMessage: string | null
  forbidden: boolean
  onReturnToForm(): void
}

export function LoginForm({ palette, signIn, signInWithBiometrics, disableBiometrics, hasDeviceContract, authMessage, forbidden, onReturnToForm }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const submissionInFlight = useRef(false)
  const reducedMotion = useReducedMotion()
  const alert = formError ?? authMessage ?? successMessage
  const alertIsSuccess = !formError && !authMessage && Boolean(successMessage)
  const blocked = !email || !password || submitting || biometricBusy

  async function submit() {
    if (submissionInFlight.current) return
    const normalizedEmail = email.trim()
    const validEmail = /^\S+@\S+\.\S+$/.test(normalizedEmail)
    setEmailError(validEmail ? null : 'Informe um e-mail válido.')
    if (!validEmail || !password) return

    setFormError(null)
    submissionInFlight.current = true
    setSubmitting(true)
    try {
      await signIn({ email: normalizedEmail, password })
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <View style={[styles.surface, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {alert ? (
        <View style={[styles.alert, { backgroundColor: alertIsSuccess ? palette.field : palette.errorSurface }]}>
          <AppText family="login" variant="caption" style={{ color: alertIsSuccess ? palette.text : palette.error }} accessibilityRole="alert">{alert}</AppText>
          {forbidden ? (
            <Pressable accessibilityRole="button" onPress={onReturnToForm} style={styles.returnAction}>
              <AppText family="login" variant="label" style={{ color: palette.error }}>Voltar ao formulário</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <LoginField
        label="E-mail"
        icon={Mail}
        palette={palette}
        value={email}
        onChangeText={(value) => { setEmail(value); setEmailError(null); setFormError(null); setSuccessMessage(null) }}
        placeholder="voce@tavvi.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        error={emailError}
      />

      <LoginField
        label="Senha"
        icon={Lock}
        palette={palette}
        value={password}
        onChangeText={(value) => { setPassword(value); setFormError(null); setSuccessMessage(null) }}
        placeholder="Sua senha"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entrar no console"
          accessibilityState={{ disabled: blocked, busy: submitting }}
          disabled={blocked}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: palette.button,
              opacity: blocked ? 0.5 : pressed ? 0.88 : 1,
              transform: [{ scale: pressed && !blocked && !reducedMotion ? 0.985 : 1 }],
            },
          ]}
        >
          <AppText family="login" variant="label" style={{ color: palette.buttonText }}>
            {submitting ? 'Entrando…' : 'Entrar no console'}
          </AppText>
          {!submitting ? <ArrowRight size={17} color={palette.buttonText} strokeWidth={2} /> : null}
          {submitting ? <ActivityIndicator color={palette.buttonText} /> : null}
        </Pressable>
        <BiometricButton colors={palette} hasDeviceContract={hasDeviceContract} onBiometricSignIn={signInWithBiometrics} disabled={submitting || biometricBusy} />
      </View>
      {hasDeviceContract ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting || biometricBusy, busy: biometricBusy }}
          disabled={submitting || biometricBusy}
          onPress={() => {
            setFormError(null)
            setSuccessMessage(null)
            setBiometricBusy(true)
            void disableBiometrics().then(() => setSuccessMessage('A biometria foi desativada neste aparelho.'))
              .catch((error) => setFormError(error instanceof Error ? error.message : 'Não foi possível desativar a biometria.'))
              .finally(() => setBiometricBusy(false))
          }}
          style={styles.unlink}
        >
          <AppText family="login" variant="caption" style={{ color: palette.subtle }}>
            {biometricBusy ? 'Confirmando…' : 'Desativar biometria neste aparelho'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  surface: { borderWidth: 1, borderRadius: 22, borderCurve: 'continuous', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 12 },
  alert: { gap: 8, padding: 12, borderRadius: 14, borderCurve: 'continuous' },
  returnAction: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  actions: { flexDirection: 'column', alignItems: 'stretch', gap: 6, marginTop: 2 },
  unlink: { minHeight: 40, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  submit: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, borderCurve: 'continuous' },
})
