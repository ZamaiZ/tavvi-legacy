import { Inter_400Regular, useFonts } from '@expo-google-fonts/inter'
import { Host } from '@expo/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type PropsWithChildren } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GluestackUIProvider } from '@ui/gluestack-ui-provider'
import { AuthProvider } from '@/features/auth/auth-context'
import { connectQueryLifecycle } from '@/lib/connectivity'
import { queryClient } from '@/lib/query-client'
import { AppThemeProvider } from '@/theme'

export function AppProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    PlusJakartaSans_400Regular: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
    PlusJakartaSans_500Medium: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
    PlusJakartaSans_800ExtraBold: require('../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf'),
    JetBrainsMono_500Medium: require('../../assets/fonts/JetBrainsMono_500Medium.ttf'),
  })
  useEffect(() => connectQueryLifecycle(), [])
  if (!fontsLoaded) return null
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AppThemeProvider><GluestackUIProvider><QueryClientProvider client={queryClient}><Host style={{ flex: 1 }}><AuthProvider>{children}</AuthProvider></Host></QueryClientProvider></GluestackUIProvider></AppThemeProvider></SafeAreaProvider></GestureHandlerRootView>
}
