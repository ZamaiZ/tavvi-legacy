'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from '@/components/ui/toast'
import type { MemberRole } from '@/domain/invite'
import { createTeamInviteAction } from '@/server/actions/invites'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Convite de equipe: o formulário, o link que aparece uma vez só (o servidor
// guarda apenas uma marca dele) e a cópia. O diálogo do desktop e o sheet do
// celular usam o mesmo estado.
export function useTeamInvite(restaurantId: string) {
  const linkRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [email, setEmailValue] = useState('')
  const [role, setRole] = useState<MemberRole>('waiter')
  const [days, setDays] = useState(7)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // A área de transferência pode ser negada. Nesse caso o link fica
  // selecionado para a cópia manual, e "Já copiei o link" passa a valer.
  const [manualCopy, setManualCopy] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => () => {
    if (holdRef.current) clearTimeout(holdRef.current)
    if (repeatRef.current) clearInterval(repeatRef.current)
  }, [])

  function setEmail(value: string) {
    setEmailValue(value)
    setError('')
  }

  function stepDays(delta: number) {
    setDays((current) => Math.min(30, Math.max(1, current + delta)))
  }

  function stopHold() {
    if (holdRef.current) clearTimeout(holdRef.current)
    if (repeatRef.current) clearInterval(repeatRef.current)
    holdRef.current = null
    repeatRef.current = null
  }

  // Segurar o + ou o − repete depois de 400 ms, como no convite do console.
  function startHold(delta: number) {
    stopHold()
    holdRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => stepDays(delta), 90)
    }, 400)
  }

  function reset() {
    setEmailValue('')
    setRole('waiter')
    setDays(7)
    setLink(null)
    setCopied(false)
    setManualCopy(false)
    setError('')
    setDiscard(false)
  }

  function submit() {
    setError('')
    const normalized = email.trim()
    if (normalized && !EMAIL.test(normalized)) {
      setError('Informe um e-mail válido ou deixe o campo vazio.')
      return
    }
    startTransition(async () => {
      const result = await createTeamInviteAction({
        restaurantId,
        role,
        email: normalized || undefined,
        expiresInDays: days,
      })
      if (result.ok) setLink(result.data.link)
      else setError(result.error || 'Não foi possível criar o convite. Tente novamente.')
    })
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      const selection = window.getSelection()
      if (linkRef.current && selection) {
        const range = document.createRange()
        range.selectNodeContents(linkRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      setManualCopy(true)
      toast.add({
        title: 'Não foi possível copiar automaticamente',
        description: 'O link ficou selecionado. Copie manualmente.',
        type: 'warning',
      })
    }
  }

  return { linkRef, email, setEmail, role, setRole, days, stepDays, startHold, stopHold, link, copied, manualCopy, error, discard, setDiscard, pending, submit, copy, reset }
}
