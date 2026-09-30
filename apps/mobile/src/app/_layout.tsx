import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { Fingerprint } from 'lucide-react-native'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'
import { useAuth } from '@/features/auth/auth-context'
import { AppProviders } from '@/providers/app-providers'
import { useAppTheme } from '@/theme'
import '@/global.css'

void SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { status, message, dismissMessage } = useAuth()
  const { resolved, hydrated } = useAppTheme()

  useEffect(() => {
    if (hydrated && status !== 'initializing') void SplashScreen.hideAsync()
  }, [hydrated, status])

  if (!hydrated || status === 'initializing') return null

  return (
    <>
      <NavigationThemeProvider value={resolved === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </NavigationThemeProvider>
      <ConfirmDialog
        visible={status === 'authenticated' && message !== null}
        title="Biometria não ativada"
        description={message ?? ''}
        confirmLabel="Entendi"
        showCancel={false}
        icon={Fingerprint}
        onCancel={dismissMessage}
        onConfirm={dismissMessage}
      />
    </>
  )
}

export default function RootLayout() {
  return <AppProviders><RootNavigator /></AppProviders>
}
