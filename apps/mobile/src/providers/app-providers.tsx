import { Host } from '@expo/ui'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type PropsWithChildren } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ToastHost } from '@/components/primitives/toast'
import { GluestackUIProvider } from '@/providers/gluestack-ui-provider'
import { AuthProvider } from '@/features/auth/auth-context'
import { connectQueryLifecycle } from '@/lib/connectivity'
import { queryClient } from '@/lib/query-client'
import { AppThemeProvider } from '@/theme'

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => connectQueryLifecycle(), [])
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><AppThemeProvider><GluestackUIProvider><QueryClientProvider client={queryClient}><Host style={{ flex: 1 }}><AuthProvider>{children}</AuthProvider></Host><ToastHost /></QueryClientProvider></GluestackUIProvider></AppThemeProvider></SafeAreaProvider></GestureHandlerRootView>
}
