import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AppState, Platform } from 'react-native'
import type { MobileSession, MobileUser, SessionInfo } from '@/contracts/mobile-api'
import { apiRequest, publicApiRequest, registerSessionInvalidator } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { publicEnvReady, supabase } from '@/lib/supabase'

export type AuthStatus = 'initializing' | 'authenticated' | 'signed-out' | 'forbidden'
export type AuthContextValue = { status: AuthStatus; user: MobileUser | null; message: string | null; signIn(input: { email: string; password: string }): Promise<void>; signOut(): Promise<void>; returnToForm(): void }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<MobileUser | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const clearSession = useCallback(async (next: 'signed-out' | 'forbidden', nextMessage: string | null) => { await supabase.auth.signOut({ scope: 'local' }); queryClient.clear(); setUser(null); setMessage(nextMessage); setStatus(next) }, [])
  const validate = useCallback(async () => { const info = await apiRequest<SessionInfo>('/api/mobile/v1/session'); setUser(info.user); setMessage(null); setStatus('authenticated') }, [])

  useEffect(() => {
    let active = true
    async function initialize() {
      if (!publicEnvReady) { if (active) { setMessage('Configure as variáveis públicas para conectar o app.'); setStatus('signed-out') }; return }
      const result = await supabase.auth.getSession()
      if (!active) return
      if (!result.data.session) { setStatus('signed-out'); return }
      try { await validate() } catch { if (active) await clearSession('signed-out', 'Sua sessão expirou. Entre novamente.') }
    }
    void initialize()
    const unregister = registerSessionInvalidator(async (reason) => clearSession(reason === 'forbidden' ? 'forbidden' : 'signed-out', reason === 'forbidden' ? 'Seu acesso administrativo foi removido.' : 'Sua sessão expirou. Entre novamente.'))
    return () => { active = false; unregister() }
  }, [clearSession, validate])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const listener = AppState.addEventListener('change', (next) => { if (next === 'active') { supabase.auth.startAutoRefresh(); if (status === 'authenticated') void validate().catch(() => undefined) } else supabase.auth.stopAutoRefresh() })
    return () => listener.remove()
  }, [status, validate])

  const signIn = useCallback(async (input: { email: string; password: string }) => { const session = await publicApiRequest<MobileSession>('/api/mobile/v1/session', { method: 'POST', body: JSON.stringify(input) }); const saved = await supabase.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken }); if (saved.error) throw saved.error; setUser(session.user); setMessage(null); setStatus('authenticated') }, [])
  const signOut = useCallback(async () => clearSession('signed-out', null), [clearSession])
  const returnToForm = useCallback(() => setStatus('signed-out'), [])
  const value = useMemo(() => ({ status, user, message, signIn, signOut, returnToForm }), [message, returnToForm, signIn, signOut, status, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider'); return value }
