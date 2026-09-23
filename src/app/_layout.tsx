import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { AppProviders } from '@/providers/app-providers'
import { useAppTheme } from '@/theme'
import '@/global.css'

void SplashScreen.preventAutoHideAsync()
function RootNavigator() { const { status } = useAuth(); const { resolved, hydrated } = useAppTheme(); useEffect(() => { if (hydrated && status !== 'initializing') void SplashScreen.hideAsync() }, [hydrated, status]); if (!hydrated || status === 'initializing') return null; return <NavigationThemeProvider value={resolved === 'dark' ? DarkTheme : DefaultTheme}><Stack screenOptions={{ headerShown: false, animation: 'none' }}><Stack.Screen name="(auth)" /><Stack.Screen name="(app)" /></Stack></NavigationThemeProvider> }
export default function RootLayout() { return <AppProviders><RootNavigator /></AppProviders> }
