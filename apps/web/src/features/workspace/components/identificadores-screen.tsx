'use client'

import { useState, useTransition } from 'react'
import { LuCheck, LuCopy, LuPlus, LuQrCode, LuSave } from 'react-icons/lu'
import { PageHeader } from '@/components/shell/page-header'
import { MobileNavBar } from '@/features/platform/components/mobile-nav-bar'
import type { TagDTO } from '@/domain/tag'
import { createTagAction, updateTagAction } from '@/server/actions/tags'

export function IdentificadoresScreen({ restaurantId, initialTags }: { restaurantId: string; initialTags: TagDTO[] }) {
  const [tags, setTags] = useState(initialTags)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialTags.map((tag) => [tag.id, tag.tableNumber?.toString() ?? ''])))
  const [newNumber, setNewNumber] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function create() {
    const tableNumber = Number(newNumber)
    if (!Number.isInteger(tableNumber) || tableNumber < 1) { setMessage('Informe um número de mesa maior que zero.'); return }
    startTransition(async () => {
      try {
        const result = await createTagAction({ restaurantId, tableNumber })
        if (!result.ok) { setMessage(result.error); return }
        setTags((current) => [...current, result.data].sort((a, b) => (a.tableNumber ?? Number.MAX_SAFE_INTEGER) - (b.tableNumber ?? Number.MAX_SAFE_INTEGER)))
        setDrafts((current) => ({ ...current, [result.data.id]: String(result.data.tableNumber ?? '') }))
        setNewNumber('')
        setMessage('Identificador criado. Copie o link para gerar o QR code.')
      } catch { setMessage('Falha de conexão ao criar o identificador. Tente novamente.') }
    })
  }

  function save(tag: TagDTO) {
    const raw = drafts[tag.id]?.trim() ?? ''
    const tableNumber = raw === '' ? null : Number(raw)
    if (tableNumber !== null && (!Number.isInteger(tableNumber) || tableNumber < 1)) { setMessage('O número da mesa precisa ser um inteiro positivo.'); return }
    startTransition(async () => {
      try {
        const result = await updateTagAction({ tagId: tag.id, tableNumber, isActive: tag.isActive })
        if (!result.ok) { setMessage(result.error); return }
        setTags((current) => current.map((item) => item.id === tag.id ? { ...item, tableNumber } : item))
        setMessage(`Mesa ${tableNumber ?? 'não definida'} salva.`)
      } catch { setMessage('Falha de conexão ao salvar. Tente novamente.') }
    })
  }

  function toggle(tag: TagDTO) {
    startTransition(async () => {
      try {
        const result = await updateTagAction({ tagId: tag.id, tableNumber: tag.tableNumber, isActive: !tag.isActive })
        if (!result.ok) { setMessage(result.error); return }
        setTags((current) => current.map((item) => item.id === tag.id ? { ...item, isActive: !item.isActive } : item))
        setMessage(tag.isActive ? 'Identificador desativado.' : 'Identificador ativado.')
      } catch { setMessage('Falha de conexão ao atualizar o identificador. Tente novamente.') }
    })
  }

  async function copy(tag: TagDTO) {
    try {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? window.location.host.replace(/^painel\./, '')
      const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rootDomain) ? 'http:' : 'https:'
      await navigator.clipboard.writeText(`${protocol}//${rootDomain}/t/${tag.publicToken}`)
      setCopied(tag.id)
      window.setTimeout(() => setCopied((value) => value === tag.id ? null : value), 1800)
    } catch { setMessage('Não foi possível copiar o link neste navegador.') }
  }

  return (
    <div className="tv-tags-page">
      <MobileNavBar backHref={`/restaurantes/${restaurantId}/ajustes`} backLabel="Ajustes" />
      <PageHeader eyebrow="Atendimento" title="Identificadores" description="Associe os QR codes às mesas e copie os links para preparar cada identificador." />
      <section className="tv-tags-create" aria-labelledby="tv-tags-create-title">
        <div><h2 id="tv-tags-create-title">Novo identificador</h2><p>O link é único e permanece igual quando você altera o número da mesa.</p></div>
        <label>Número da mesa<input type="number" min="1" step="1" inputMode="numeric" value={newNumber} onChange={(event) => setNewNumber(event.target.value)} /></label>
        <button type="button" disabled={busy} onClick={create}><LuPlus aria-hidden="true" /> Criar identificador</button>
      </section>
      <p className="tv-tags-message" role="status" aria-live="polite">{message}</p>
      {tags.length === 0 ? <div className="tv-tags-empty"><LuQrCode aria-hidden="true" /><strong>Nenhum identificador cadastrado</strong><span>Crie um identificador para começar a associar mesas.</span></div> : (
        <section className="tv-tags-list" aria-label="Identificadores do restaurante">
          {tags.map((tag) => <article className="tv-tag-card" key={tag.id}>
            <div className="tv-tag-heading"><span className="tv-tag-icon"><LuQrCode aria-hidden="true" /></span><div><strong>{tag.tableNumber ? `Mesa ${tag.tableNumber}` : 'Mesa sem número'}</strong><span>{tag.isActive ? 'Ativa' : 'Desativada'}{tag.lastSeenAt ? ` · Acessada ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(tag.lastSeenAt))}` : ''}</span></div></div>
            <div className="tv-tag-controls"><label>Número da mesa<input aria-label={`Número da mesa para o identificador ${tag.id}`} type="number" min="1" step="1" inputMode="numeric" value={drafts[tag.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [tag.id]: event.target.value }))} /></label><button type="button" disabled={busy} onClick={() => save(tag)}><LuSave aria-hidden="true" /> Salvar</button><button type="button" disabled={busy} onClick={() => toggle(tag)}>{tag.isActive ? 'Desativar' : 'Ativar'}</button><button type="button" className="is-copy" onClick={() => void copy(tag)}>{copied === tag.id ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}{copied === tag.id ? 'Copiado' : 'Copiar link'}</button></div>
            {!tag.tableNumber ? <p className="tv-tag-warning">Defina o número antes de usar este identificador para chamar a equipe.</p> : null}
          </article>)}
        </section>
      )}
    </div>
  )
}
