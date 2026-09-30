'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPlatformInviteAction, rotatePlatformInviteAction } from '@/server/actions/invites'
import { toast } from '@/components/ui/toast'
import { isMobileViewport, markStackedFromList, openedFromList } from '@/lib/viewport'

export type InviteSheetRequest = { email?: string; inviteId?: string }

// Estado e ações do convite, sem visual: o desktop (painel lateral) e o
// celular (sheet do iOS) desenham a mesma coisa de jeitos diferentes.
export function useInviteSheet(request: InviteSheetRequest | null, onClose: () => void) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [days, setDays] = useState(7)
  const [link, setLink] = useState<string | null>(null)
  const [newInviteId, setNewInviteId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const [pending, startTransition] = useTransition()
  const linkRef = useRef<HTMLDivElement>(null)
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotating = Boolean(request?.inviteId)

  useEffect(() => {
    if (!request) return
    setEmail(request.email ?? '')
    setDays(7)
    setLink(null)
    setNewInviteId(null)
    setCopied(false)
    setError('')
    setDiscard(false)
  }, [request])
  useEffect(() => () => {
    if (holdRef.current) clearTimeout(holdRef.current)
    if (repeatRef.current) clearInterval(repeatRef.current)
  }, [])

  function requestClose() {
    if (link && !copied) { setDiscard(true); return }
    onClose()
    setTimeout(() => { setLink(null); setCopied(false); setDiscard(false) }, 360)
  }

  function stepDays(delta: number) {
    setDays((current) => Math.max(1, Math.min(30, current + delta)))
  }
  function startHold(delta: number) {
    stopHold()
    holdRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => stepDays(delta), 90)
    }, 400)
  }
  function stopHold() {
    if (holdRef.current) clearTimeout(holdRef.current)
    if (repeatRef.current) clearInterval(repeatRef.current)
    holdRef.current = null
    repeatRef.current = null
  }

  function submit() {
    setError('')
    const normalized = email.trim()
    if (!rotating && normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError('Informe um e-mail válido ou deixe o campo vazio.')
      return
    }
    startTransition(async () => {
      const result = rotating
        ? await rotatePlatformInviteAction(request!.inviteId!)
        : await createPlatformInviteAction({ email: normalized || undefined, expiresInDays: days })
      if (!result.ok) { setError(result.error || 'Não foi possível criar o convite. Tente novamente.'); return }
      setLink(result.data.link)
      setNewInviteId(result.data.id)
      // O novo convite substitui o anterior: no celular, a tela empilhada
      // passa a ser a dele; no desktop, a gaveta.
      if (rotating && isMobileViewport()) {
        // A marca de "aberto pela lista" acompanha a troca de id, para o
        // voltar continuar desempilhando.
        if (openedFromList(`/convites/${request!.inviteId}`)) markStackedFromList(`/convites/${result.data.id}`)
        router.replace(`/convites/${result.data.id}`, { scroll: false })
      } else if (rotating) router.replace(`/?convite=${result.data.id}`, { scroll: false })
      router.refresh()
    })
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setError('')
    } catch {
      const selection = window.getSelection()
      const range = document.createRange()
      if (linkRef.current) {
        range.selectNodeContents(linkRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      setError('Selecione e copie manualmente')
    }
  }

  function done() {
    onClose()
    if (newInviteId && !rotating) toast.add({ title: 'Convite criado', type: 'success' })
    setTimeout(() => { setLink(null); setCopied(false) }, 360)
    router.refresh()
  }

  function discardLink() {
    setDiscard(false)
    setLink(null)
    onClose()
  }

  useEffect(() => {
    if (!request) return
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
    document.addEventListener('keydown', keydown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previous }
  }, [copied, link, onClose, request])

  return { email, setEmail, days, stepDays, startHold, stopHold, link, linkRef, copied, error, discard, setDiscard, pending, rotating, requestClose, submit, copyLink, done, discardLink }
}

export type InviteSheetState = ReturnType<typeof useInviteSheet>
