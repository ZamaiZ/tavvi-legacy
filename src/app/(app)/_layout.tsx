import { Redirect, Stack } from 'expo-router'
import { AppShell } from '@/components/shell/app-shell'
import { useAuth } from '@/features/auth/auth-context'
export default function ProtectedLayout() { const { status } = useAuth(); if (status === 'initializing') return null; if (status !== 'authenticated') return <Redirect href="/entrar" />; return <AppShell><Stack screenOptions={{ headerShown: false, animation: 'none' }} /></AppShell> }
