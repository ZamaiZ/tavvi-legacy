'use client'

import { useEffect, useRef, useState } from 'react'
import { LuCheck, LuRadioTower } from 'react-icons/lu'
import type { NfcEventDTO, TagDTO } from '@/domain/tag'
import { listNfcEventsAction, recordNfcEventAction } from '@/server/actions/tags'
import { tagPublicUrl } from './identificadores-utils'

type NfcRecord = { recordType: string; data: DataView }
type NfcReading = { serialNumber: string; message: { records: NfcRecord[] } }
type NfcReader = {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(message: { records: { recordType: 'url'; data: string }[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>
  onreading: ((event: NfcReading) => void) | null
  onreadingerror: (() => void) | null
}
type NfcConstructor = new () => NfcReader

function readerConstructor(): NfcConstructor | null {
  return (window as Window & { NDEFReader?: NfcConstructor }).NDEFReader ?? null
}

function serialFrom(value: string): string | null {
  const serial = value.replace(/[:-]/g, '').toUpperCase()
  return /^[0-9A-F]{14}$/.test(serial) ? serial : null
}

function urlFrom(event: NfcReading): string | null {
  const record = event.message.records.find((item) => item.recordType === 'url')
  return record ? new TextDecoder().decode(record.data) : null
}

function nfcErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof DOMException) {
    if (cause.name === 'NotAllowedError' || cause.name === 'SecurityError') return 'Permita o acesso a NFC para este site no Chrome e tente novamente.'
    if (cause.name === 'NotSupportedError') return 'Este aparelho ou esta etiqueta não oferece o formato NFC necessário.'
    if (cause.name === 'InvalidStateError') return 'Ative o NFC do aparelho e mantenha esta página aberta para continuar.'
    if (cause.name === 'AbortError') return 'Operação NFC cancelada.'
    return fallback
  }
  return cause instanceof Error ? cause.message : fallback
}

async function readOnce(controller: AbortController): Promise<NfcReading> {
  const Constructor = readerConstructor()
  if (!Constructor) throw new Error('Web NFC indisponível neste navegador.')
  const reader = new Constructor()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const reading = new Promise<NfcReading>((resolve, reject) => {
      reader.onreading = resolve
      reader.onreadingerror = () => reject(new Error('Não foi possível ler esta etiqueta.'))
      controller.signal.addEventListener('abort', () => reject(new Error('Leitura cancelada.')), { once: true })
      timeout = setTimeout(() => reject(new Error('Tempo esgotado. Aproxime novamente a etiqueta.')), 30000)
    })
    // scan() pode falhar antes de aguardarmos o evento; absorve a rejeição
    // pendente que o abort do finally provoca nesse caso.
    void reading.catch(() => undefined)
    await reader.scan({ signal: controller.signal })
    return await reading
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

type Phase = 'idle' | 'reading' | 'ready' | 'writing' | 'written' | 'verifying' | 'done'
const failureLabels: Record<string, string> = {
  write_error: 'falha na gravação',
  read_error: 'falha na leitura',
  wrong_tag: 'etiqueta diferente',
  wrong_url: 'link diferente',
  cancelled: 'operação cancelada',
}

export function TagNfcRegistration({ tag, onVerified }: { tag: TagDTO; onVerified: (serial: string, verifiedAt: string) => void }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [serial, setSerial] = useState<string | null>(null)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<NfcEventDTO[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const url = tagPublicUrl(tag)
  // Limite conservador: URI NDEF também consome bytes de cabeçalho e TLV.
  const fitsNtag213 = new TextEncoder().encode(url).length + 10 <= 144

  useEffect(() => {
    setSupported(Boolean(readerConstructor()) && window.isSecureContext)
    return () => controller.current?.abort()
  }, [])

  async function recordFailure(reason: 'write_error' | 'read_error' | 'wrong_tag' | 'wrong_url' | 'cancelled'): Promise<boolean> {
    if (!operationId || !serial) return false
    try {
      const result = await recordNfcEventAction({ tagId: tag.id, operationId, serial, event: 'failed', reason })
      return result.ok
    } catch {
      return false
    }
  }

  async function identify() {
    if (phase === 'reading') return
    setError('')
    setPhase('reading')
    const active = new AbortController()
    controller.current = active
    try {
      const reading = await readOnce(active)
      const foundSerial = serialFrom(reading.serialNumber)
      if (!foundSerial) throw new Error('Este aparelho não informou o número de série da etiqueta. Não é possível vinculá-la com segurança.')
      const foundUrl = urlFrom(reading)
      const id = crypto.randomUUID()
      const result = await recordNfcEventAction({ tagId: tag.id, operationId: id, serial: foundSerial, event: 'started' })
      if (!result.ok) throw new Error(result.error)
      setSerial(foundSerial)
      setExistingUrl(foundUrl)
      setOperationId(id)
      setPhase('ready')
    } catch (cause) {
      setError(nfcErrorMessage(cause, 'Não foi possível ler a etiqueta.'))
      setPhase('idle')
    } finally {
      controller.current = null
    }
  }

  async function write() {
    if (phase !== 'ready' || !serial || !operationId || !fitsNtag213) return
    const Constructor = readerConstructor()
    if (!Constructor) return
    const active = new AbortController()
    controller.current = active
    try {
      // A chamada de write ocorre diretamente no gesto; não há await antes dela.
      const writing = new Constructor().write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal: active.signal })
      setPhase('writing')
      setError('')
      await writing
      setPhase('written')
    } catch (cause) {
      await recordFailure('write_error')
      setError(nfcErrorMessage(cause, 'A gravação não foi confirmada. Aproxime a etiqueta e tente novamente.'))
      setPhase('ready')
    } finally {
      controller.current = null
    }
  }

  async function verify() {
    if (!serial || !operationId || (phase !== 'written' && phase !== 'ready')) return
    setPhase('verifying')
    setError('')
    const active = new AbortController()
    controller.current = active
    let mismatch: 'wrong_tag' | 'wrong_url' | null = null
    let readCompleted = false
    try {
      const reading = await readOnce(active)
      readCompleted = true
      if (serialFrom(reading.serialNumber) !== serial) {
        mismatch = 'wrong_tag'
        await recordFailure('wrong_tag')
        throw new Error('Esta não é a mesma etiqueta lida no início. Aproxime a etiqueta correta.')
      }
      const observedUrl = urlFrom(reading)
      setExistingUrl(observedUrl)
      if (observedUrl !== url) {
        mismatch = 'wrong_url'
        await recordFailure('wrong_url')
        throw new Error('O link lido não corresponde ao identificador desta mesa. Grave novamente.')
      }
      const result = await recordNfcEventAction({ tagId: tag.id, operationId, serial, event: 'verified' })
      if (!result.ok || !result.data.verifiedAt) throw new Error(result.ok ? 'Não foi possível confirmar o vínculo.' : result.error)
      onVerified(serial, result.data.verifiedAt)
      setHistory(null)
      setPhase('done')
    } catch (cause) {
      if (!readCompleted) await recordFailure('read_error')
      setError(nfcErrorMessage(cause, 'Não foi possível verificar a etiqueta.'))
      setPhase(mismatch ? 'ready' : 'written')
    } finally {
      controller.current = null
    }
  }

  async function toggleHistory() {
    if (historyOpen) { setHistoryOpen(false); return }
    setHistoryOpen(true)
    if (history) return
    setHistoryBusy(true)
    try {
      const result = await listNfcEventsAction(tag.id)
      if (result.ok) setHistory(result.data)
      else setError(result.error)
    } catch {
      setError('Não foi possível carregar o histórico NFC.')
    } finally {
      setHistoryBusy(false)
    }
  }

  async function restart() {
    await recordFailure('cancelled')
    setPhase('idle')
    setSerial(null)
    setOperationId(null)
    setExistingUrl(null)
    setError('')
    setHistory(null)
  }

  const busy = phase === 'reading' || phase === 'writing' || phase === 'verifying'
  return <section className="tv-tag-nfc" aria-label="Etiqueta NFC">
    <div className="tv-tag-nfc-heading"><LuRadioTower aria-hidden="true" /><div><strong>Etiqueta NFC</strong><span>{tag.nfcSerial ? `Vinculada · ${tag.nfcSerial}` : 'Nenhuma etiqueta física vinculada'}</span></div></div>
    {tag.nfcVerifiedAt ? <p className="tv-tag-nfc-meta">Conferida em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(tag.nfcVerifiedAt))}</p> : null}
    {supported === false ? <p>Para registrar, abra este painel no Chrome de um Android com NFC ativado. Depois de gravada, a URL pode ser lida também por iPhone.</p> : null}
    {!tag.isActive ? <p>O link ficará indisponível para clientes enquanto este identificador estiver desativado.</p> : null}
    {!fitsNtag213 ? <p className="tv-tag-form-error">O link excede o espaço seguro estimado para uma NTAG213.</p> : null}
    {supported && fitsNtag213 ? <>
      {phase === 'idle' ? <button type="button" onClick={() => void identify()}>Ler etiqueta</button> : null}
      {phase === 'reading' ? <p>Aproxime a etiqueta para ler o número de série…</p> : null}
      {phase === 'ready' && serial ? <>
        <p>Etiqueta {serial}. {existingUrl ? existingUrl === url ? 'O link correto já está gravado.' : 'Há outro link gravado; a gravação irá substituí-lo.' : 'Nenhum link de URL encontrado.'}</p>
        <div className="tv-tag-nfc-actions"><button type="button" onClick={() => void write()}>{existingUrl && existingUrl !== url ? 'Substituir link na etiqueta' : 'Gravar link'}</button>{existingUrl === url ? <button type="button" onClick={() => void verify()}>Conferir e vincular</button> : null}</div>
      </> : null}
      {phase === 'writing' ? <p>Aproxime a etiqueta para gravar o link…</p> : null}
      {phase === 'written' ? <><p>Gravação concluída. Aproxime a mesma etiqueta mais uma vez para confirmar o conteúdo.</p><button type="button" onClick={() => void verify()}>Verificar etiqueta</button></> : null}
      {phase === 'verifying' ? <p>Aproxime a mesma etiqueta para conferir número de série e link…</p> : null}
      {phase === 'done' ? <p className="tv-tag-nfc-success"><LuCheck aria-hidden="true" />Etiqueta vinculada e link conferido neste aparelho.</p> : null}
      {phase !== 'idle' && !busy && phase !== 'done' ? <button type="button" className="is-quiet" onClick={() => void restart()}>Começar com outra etiqueta</button> : null}
    </> : null}
    {error ? <p className="tv-tag-form-error" role="alert">{error}</p> : null}
    {tag.nfcSerial && phase === 'idle' ? <p>Ao substituir, apague ou descarte a etiqueta anterior: o link nela continuará válido enquanto o identificador estiver ativo.</p> : null}
    <button type="button" className="is-quiet" onClick={() => void toggleHistory()}>{historyOpen ? 'Ocultar histórico' : 'Ver histórico NFC'}</button>
    {historyOpen ? <div className="tv-tag-nfc-history" aria-live="polite">
      {historyBusy ? <p>Carregando histórico…</p> : history?.length === 0 ? <p>Sem operações NFC registradas.</p> : history?.map((event, index) => <div key={`${event.createdAt}-${index}`}>
        <strong>{event.action === 'started' ? 'Leitura iniciada' : event.action === 'verified' ? 'Etiqueta vinculada' : event.action === 'routing_changed' ? 'Mesa ou disponibilidade alterada' : 'Operação não concluída'}</strong>
        <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(event.createdAt))}{event.serial ? ` · ${event.serial}` : ''}</span>
        {event.reason ? <span>{event.action === 'routing_changed' ? event.reason : `Motivo: ${failureLabels[event.reason] ?? event.reason}`}</span> : null}
        {event.actorId ? <span>Operador: {event.actorId.slice(0, 8)}</span> : null}
      </div>)}</div> : null}
  </section>
}
