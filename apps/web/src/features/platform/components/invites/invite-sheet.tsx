'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LuArrowRight, LuCheck, LuCopy, LuMail, LuMinus, LuPlus, LuTriangleAlert, LuX } from 'react-icons/lu'
import { createPlatformInviteAction, rotatePlatformInviteAction } from '@/server/actions/invites'
import { toast } from '@/components/ui/toast'
import { PrimaryCTA } from '../buttons'

export type InviteSheetRequest = { email?: string; inviteId?: string }

export function InviteSheet({ request, onClose }: { request: InviteSheetRequest | null; onClose: () => void }) {
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

  function startHold(delta: number) {
    stopHold()
    holdRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => setDays((current) => Math.max(1, Math.min(30, current + delta))), 90)
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
      if (rotating) router.replace(`/?convite=${result.data.id}`, { scroll: false })
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

  useEffect(() => {
    if (!request) return
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
    document.addEventListener('keydown', keydown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previous }
  }, [copied, link, onClose, request])

  if (!request) return null
  return <>
    <button className="tv-sheet-scrim" aria-label="Fechar novo convite" onClick={requestClose} />
    <section role="dialog" aria-modal="true" aria-label={link ? 'Link do convite' : rotating ? 'Novo link' : 'Novo convite'} className="tv-invite-sheet">
      <header><button type="button" className="tv-icon-button" aria-label="Fechar" onClick={requestClose}><LuX /></button></header>
      {link ? <div className="tv-invite-sheet-body tv-created-state">
        <div className="tv-created-heading"><span><LuCheck /></span><div><h2>Convite criado<i>.</i></h2><p>Copie agora. O link não será exibido novamente.</p></div></div>
        <div className="tv-warning-box"><LuTriangleAlert /><span>O sistema guarda apenas uma marca deste link, e não consegue reconstruí-lo. Se você fechar sem copiar, terá que emitir outro convite.</span></div>
        <div className="tv-created-link tv-mono" ref={linkRef} tabIndex={0}>{link}</div>
        <button type="button" className={`tv-copy-button${copied ? ' is-copied' : ''}`} onClick={copyLink}>{copied ? <LuCheck /> : <LuCopy />}{copied ? 'Link copiado' : 'Copiar link'}</button>
        {error && <p role="alert" className="tv-field-error">{error}</p>}
        <PrimaryCTA disabled={!copied} onClick={done}>Já copiei o link<LuArrowRight /></PrimaryCTA>
      </div> : <div className="tv-invite-sheet-body">
        <h2>{rotating ? 'Novo link' : 'Novo convite'}<i>.</i></h2>
        <p className="tv-form-description">{rotating ? 'O link atual deixa de funcionar e um novo é gerado para o mesmo destinatário e prazo.' : 'Crie um acesso de administrador da plataforma.'}</p>
        {error && <p role="alert" className="tv-field-error">{error}</p>}
        <label className="tv-field-label" htmlFor="tv-invite-email">E-mail (opcional)</label>
        <div className="tv-input-wrap"><LuMail /><input id="tv-invite-email" type="email" value={email} readOnly={rotating} placeholder="Qualquer e-mail" onChange={(event) => setEmail(event.target.value)} /></div>
        {!rotating && <p className="tv-field-help">Preenchido, o link só funciona para quem entrar com esse e-mail.</p>}
        <label className="tv-field-label" htmlFor="tv-invite-days">Validade</label>
        <div className={`tv-stepper${rotating ? ' is-disabled' : ''}`}>
          <button type="button" aria-label="Menos dias" disabled={rotating || days <= 1} onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold} onClick={() => setDays((current) => Math.max(1, current - 1))}><LuMinus /></button>
          <output id="tv-invite-days">{rotating ? `Validade: ${days} dias` : `${days} ${days === 1 ? 'dia' : 'dias'}`}</output>
          <button type="button" aria-label="Mais dias" disabled={rotating || days >= 30} onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold} onClick={() => setDays((current) => Math.min(30, current + 1))}><LuPlus /></button>
        </div>
        <p className="tv-field-help">Escolha entre 1 e 30 dias. Depois desse prazo o link para de funcionar e você emite outro. Quem aceitar dentro do prazo não perde o acesso depois.</p>
        <PrimaryCTA disabled={pending} onClick={submit}>{pending ? <><span className="tv-spinner" />Gerando…</> : <>{rotating ? 'Gerar novo link' : 'Gerar link'}<LuArrowRight /></>}</PrimaryCTA>
      </div>}
    </section>
    {discard && <div className="tv-confirm-scrim"><section role="alertdialog" aria-modal="true" aria-label="Descartar link?" className="tv-confirm-dialog"><span className="tv-state-icon"><LuTriangleAlert /></span><h2>Descartar link?</h2><p>Esse link é exibido uma única vez.</p><div><button type="button" className="tv-secondary-cta" onClick={() => setDiscard(false)}>Voltar ao link</button><button type="button" className="tv-tonal-button" onClick={() => { setDiscard(false); setLink(null); onClose() }}>Descartar</button></div></section></div>}
  </>
}
