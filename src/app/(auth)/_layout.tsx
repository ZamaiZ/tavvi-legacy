import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/features/auth/auth-context'
export default function AuthLayout() { const { status } = useAuth(); if (status === 'authenticated') return <Redirect href="/" />; return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} /> }
