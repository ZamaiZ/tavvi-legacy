import { AppText } from '@/components/primitives/app-text'
import { brand, spacing, useAppTheme } from '@/theme'
import { Image } from 'expo-image'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from './auth-context'
import { LoginBackdrop } from './login-backdrop'
import { LoginForm } from './login-form'
import { LoginHero } from './login-hero'
import { getLoginPalette } from './login-theme'

const wordmark = require('../../../assets/images/brand/tavvi-wordmark.png')

export function LoginScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { resolved, preference, setPreference } = useAppTheme()
  const { signIn, signInWithBiometrics, disableBiometrics, hasDeviceContract, message, status, returnToForm } = useAuth()
  const palette = getLoginPalette(resolved)
  const contentWidth = Math.min(Math.max(width - spacing.x6 * 2, 0), 440)
  const year = new Date().getFullYear()

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: palette.screen }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <LoginBackdrop palette={palette} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top + 12, spacing.x6),
            paddingBottom: Math.max(insets.bottom + spacing.x5, spacing.x8),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={process.env.EXPO_OS === 'android' ? 'none' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth }]}>
          <LoginHero
            width={contentWidth}
            palette={palette}
            preference={preference}
            onThemeChange={setPreference}
          />
          <LoginForm
            palette={palette}
            signIn={signIn}
            signInWithBiometrics={signInWithBiometrics}
            disableBiometrics={disableBiometrics}
            hasDeviceContract={hasDeviceContract}
            authMessage={message}
            forbidden={status === 'forbidden'}
            onReturnToForm={returnToForm}
          />
          <View style={styles.spacer} />
          <View style={styles.footer}>
            <Image
              source={wordmark}
              contentFit="contain"
              accessible={false}
              tintColor={resolved === 'light' ? brand.ink : undefined}
              style={styles.wordmark}
            />
            <View style={[styles.dot, { backgroundColor: palette.border }]} />
            <AppText family="login" variant="caption" style={{ color: palette.subtle }}>{year}</AppText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.x3 },
  content: { flexGrow: 1, gap: spacing.x4 },
  spacer: { flex: 1, minHeight: spacing.x5 },
  footer: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.x2 },
  wordmark: { width: 44, height: 16, opacity: 0.5 },
  dot: { width: 3, height: 3, borderRadius: 2 },
})
