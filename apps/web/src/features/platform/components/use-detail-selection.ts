'use client'

import { useCallback, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

function withParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (value) params.set(key, value)
  else params.delete(key)
  const query = params.toString()
  return query ? `?${query}` : ''
}

// Seleção feita só no cliente, para detalhes que a lista já traz completos
// (convite). A URL acompanha por history.replaceState, que o Next sincroniza
// com useSearchParams sem ir ao servidor.
export function useLocalSelection(key: string, initialId: string | null) {
  const [openId, setOpenId] = useState(initialId)
  const select = useCallback((id: string | null) => {
    setOpenId(id)
    window.history.replaceState(null, '', `${window.location.pathname}${withParam(key, id)}`)
  }, [key])
  return [openId, select] as const
}

// Seleção cujo detalhe vem do servidor pelo parâmetro da URL (restaurante).
// O id otimista abre o drawer no mesmo frame do clique; enquanto a navegação
// não termina, `serverId` ainda é o anterior e o drawer mostra o esqueleto.
export function useServerSelection(key: string, path: string, serverId: string | null) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openId, setOpenId] = useOptimistic(serverId)
  const select = useCallback((id: string | null) => {
    startTransition(() => {
      setOpenId(id)
      router.replace(`${path}${withParam(key, id)}`, { scroll: false })
    })
  }, [key, path, router, setOpenId])
  return [openId, select] as const
}
