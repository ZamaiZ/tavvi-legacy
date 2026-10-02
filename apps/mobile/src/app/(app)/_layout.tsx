import { Redirect, Tabs } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Mail, Store, UserRound } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '@/theme'
import { useAuth } from '@/features/auth/auth-context'
import { AccountSheet } from '@/features/account/account-sheet'
import { useInvitations } from '@/features/invitations/queries'
import { getInviteState } from '@/features/invitations/invitation-state'

export default function ProtectedLayout() {
  const { status } = useAuth()
  if (status === 'initializing') return null
  if (status !== 'authenticated') return <Redirect href="/login" />
  return <AuthenticatedTabs />
}

function AuthenticatedTabs() {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const invitations = useInvitations()
  const [now, setNow] = useState(Date.now())
  const [accountOpen, setAccountOpen] = useState(false)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])
  const pendingCount = invitations.data?.filter((invite) => getInviteState(invite, now) === 'pending').length ?? 0

  return (
    <>
      <Tabs
        screenListeners={{ tabPress: () => { void Haptics.selectionAsync() } }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.goldText,
          tabBarInactiveTintColor: colors.subtle,
          tabBarStyle: {
            height: 84 + insets.bottom,
            paddingTop: 10,
            paddingBottom: 8 + insets.bottom,
            backgroundColor: colors.bar,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            elevation: 0,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '500' },
          tabBarItemStyle: { minHeight: 48 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Convites',
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.goldInk },
            tabBarIcon: ({ color, size }) => <Mail color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="restaurants/index"
          options={{
            title: 'Restaurantes',
            tabBarIcon: ({ color, size }) => <Store color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Conta',
            tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
          }}
          listeners={{
            // A aba Conta não navega: abre o sheet com Tema e Sair.
            tabPress: (event) => {
              event.preventDefault()
              setAccountOpen(true)
            },
          }}
        />
        <Tabs.Screen name="invitations/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="restaurants/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  )
}
