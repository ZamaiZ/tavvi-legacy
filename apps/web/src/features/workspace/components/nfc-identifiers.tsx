'use client'

import { useEffect, useRef, useState } from 'react'
import { LuCheck, LuRadioTower } from 'react-icons/lu'
import type { NfcEventDTO, TagDTO } from '@/domain/tag'
import { listNfcEventsAction, recordNfcEventAction } from '@/server/actions/tags'
import { PanelConfirm } from './panel-confirm'
import { tagPublicUrl } from './identifiers-utils'

type NfcRecord = { recordType: string; data: DataView }
type NfcReading = { serialNumber: string; message: { records: NfcRecord[] } }
type NfcReader = {
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(message: { records: { recordType: 'url'; data: string }[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>
  makeReadOnly?(options?: { signal?: AbortSignal }): Promise<void>
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
  if (event.message.records.length !== 1) return null
  const [record] = event.message.records
  return record.recordType === 'url' ? new TextDecoder().decode(record.data) : null
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

type Phase = 'idle' | 'reading' | 'ready' | 'writing' | 'written' | 'verifying' | 'recording_verified' | 'verified_pending' | 'awaiting_lock_target' | 'locking' | 'sync_reading' | 'syncing' | 'done'
type ProtectionReceipt = {
  tagId: string
  operationId: string
  serial: string
  url: string
  status: 'attempting' | 'applied'
  startedAt: string
  appliedAt?: string
}

function protectionReceiptKey(tagId: string) {
  return `tavvi:nfc-protection:${tagId}`
}

function parseProtectionReceipt(value: string): ProtectionReceipt | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const receipt = parsed as Partial<ProtectionReceipt>
    if (
      typeof receipt.tagId !== 'string' ||
      typeof receipt.operationId !== 'string' ||
      typeof receipt.serial !== 'string' || !/^[0-9A-F]{14}$/.test(receipt.serial) ||
      typeof receipt.url !== 'string' ||
      (receipt.status !== 'attempting' && receipt.status !== 'applied') ||
      typeof receipt.startedAt !== 'string' || !Number.isFinite(Date.parse(receipt.startedAt)) ||
      (receipt.appliedAt !== undefined && (typeof receipt.appliedAt !== 'string' || !Number.isFinite(Date.parse(receipt.appliedAt)))
    )) return null
    return receipt as ProtectionReceipt
  } catch {
    return null
  }
}

const failureLabels: Record<string, string> = {
  write_error: 'falha na gravação',
  read_error: 'falha na leitura',
  wrong_tag: 'etiqueta diferente',
  wrong_url: 'link diferente',
  cancelled: 'operação cancelada',
  protection_error: 'falha ao proteger contra regravação',
}

export function TagNfcRegistration({ tag, onVerified, onProtected }: { tag: TagDTO; onVerified: (serial: string, verifiedAt: string) => void; onProtected: (serial: string, protectedAt: string) => void }) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [protectionSupported, setProtectionSupported] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [serial, setSerial] = useState<string | null>(null)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<NfcEventDTO[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingReceipt, setPendingReceipt] = useState<ProtectionReceipt | null>(null)
  const [receiptConflict, setReceiptConflict] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const url = tagPublicUrl(tag)
  // Limite conservador: URI NDEF também consome bytes de cabeçalho e TLV.
  const fitsNtag213 = new TextEncoder().encode(url).length + 10 <= 144

  useEffect(() => {
    const Constructor = readerConstructor()
    const secure = window.isSecureContext
    setSupported(Boolean(Constructor) && secure)
    setProtectionSupported(Boolean(Constructor && typeof new Constructor().makeReadOnly === 'function') && secure)
    return () => controller.current?.abort()
  }, [])

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(protectionReceiptKey(tag.id))
      if (tag.nfcProtectedAt) {
        window.localStorage.removeItem(protectionReceiptKey(tag.id))
        setPendingReceipt(null)
        setReceiptConflict(false)
        return
      }
    } catch {
      setReceiptConflict(true)
      return
    }
    if (!raw) {
      setPendingReceipt(null)
      setReceiptConflict(false)
      return
    }
    const receipt = parseProtectionReceipt(raw)
    if (!receipt || receipt.tagId !== tag.id || receipt.url !== url || receipt.serial !== tag.nfcSerial) {
      setPendingReceipt(null)
      setReceiptConflict(true)
      return
    }
    setPendingReceipt(receipt)
    setReceiptConflict(false)
  }, [tag.id, tag.nfcProtectedAt, tag.nfcSerial, url])

  function hasStoredReceipt() {
    try {
      return Boolean(window.localStorage.getItem(protectionReceiptKey(tag.id)))
    } catch {
      return true
    }
  }

  async function recordFailure(reason: 'write_error' | 'read_error' | 'wrong_tag' | 'wrong_url' | 'cancelled' | 'protection_error'): Promise<boolean> {
    if (!operationId || !serial) return false
    try {
      const result = await recordNfcEventAction({ tagId: tag.id, operationId, serial, event: 'failed', reason })
      return result.ok
    } catch {
      return false
    }
  }

  async function identify() {
    if (phase === 'reading' || tag.nfcProtectedAt || pendingReceipt || receiptConflict || hasStoredReceipt()) return
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
    if (phase !== 'ready' || !serial || !operationId || !fitsNtag213 || tag.nfcProtectedAt || pendingReceipt || receiptConflict || hasStoredReceipt()) return
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
    const returnPhase = phase
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
        void recordFailure('wrong_tag')
        throw new Error('Esta não é a mesma etiqueta lida no início. Aproxime a etiqueta correta.')
      }
      const observedUrl = urlFrom(reading)
      setExistingUrl(observedUrl)
      if (observedUrl !== url) {
        mismatch = 'wrong_url'
        void recordFailure('wrong_url')
        throw new Error('O link lido não corresponde ao identificador desta mesa. Grave novamente.')
      }
      setPhase('recording_verified')
      const result = await recordNfcEventAction({ tagId: tag.id, operationId, serial, event: 'verified' })
      if (!result.ok || !result.data.verifiedAt) throw new Error(result.ok ? 'Não foi possível confirmar o vínculo.' : result.error)
      onVerified(serial, result.data.verifiedAt)
      setHistory(null)
      setPhase('verified_pending')
      if (protectionSupported) setConfirmOpen(true)
    } catch (cause) {
      if (!readCompleted) await recordFailure('read_error')
      setError(nfcErrorMessage(cause, 'Não foi possível verificar a etiqueta.'))
      setPhase(mismatch ? 'ready' : returnPhase)
    } finally {
      controller.current = null
    }
  }

  function removeStoredReceipt() {
    try {
      window.localStorage.removeItem(protectionReceiptKey(tag.id))
      setPendingReceipt(null)
      setReceiptConflict(false)
    } catch {
      setReceiptConflict(true)
    }
  }

  async function submitProtectedReceipt(receipt: ProtectionReceipt) {
    setPhase('syncing')
    setError('')
    try {
      const result = await recordNfcEventAction({
        tagId: receipt.tagId,
        operationId: receipt.operationId,
        serial: receipt.serial,
        event: 'protected',
      })
      if (!result.ok) throw new Error(result.error)
      if (!result.data.protectedAt) throw new Error('O painel não confirmou o registro da proteção.')
      removeStoredReceipt()
      onProtected(receipt.serial, result.data.protectedAt)
      setHistory(null)
      setPhase('done')
    } catch (cause) {
      setPendingReceipt(receipt)
      setError(`Etiqueta protegida, mas a sincronização falhou. Tente sincronizar novamente. ${nfcErrorMessage(cause, '')}`.trim())
      setPhase('verified_pending')
    }
  }

  function startProtection() {
    if (phase !== 'verified_pending' || !serial || !operationId || !protectionSupported || tag.nfcProtectedAt || pendingReceipt?.status === 'applied') return
    const Constructor = readerConstructor()
    if (!Constructor) return
    const reader = new Constructor()
    if (typeof reader.makeReadOnly !== 'function') {
      setProtectionSupported(false)
      setError('Este aparelho não oferece bloqueio permanente. A etiqueta continua gravável e a proteção fica pendente.')
      return
    }

    const receipt: ProtectionReceipt = {
      tagId: tag.id,
      operationId,
      serial,
      url,
      status: 'attempting',
      startedAt: new Date().toISOString(),
    }
    try {
      // Registrar a tentativa antes do comando irreversível protege contra
      // fechamento da página enquanto o navegador ainda está bloqueando.
      window.localStorage.setItem(protectionReceiptKey(tag.id), JSON.stringify(receipt))
      setPendingReceipt(receipt)
    } catch {
      setError('Não foi possível preparar a recuperação local. A etiqueta não foi bloqueada; tente novamente neste aparelho.')
      return
    }

    const active = new AbortController()
    controller.current = active
    let lockStarted = false
    const timeout = setTimeout(() => {
      if (lockStarted) return
      lockStarted = true
      active.abort()
      removeStoredReceipt()
      void recordFailure('read_error')
      setError('A etiqueta não foi lida a tempo. Nenhum bloqueio foi solicitado; aproxime a etiqueta e tente novamente.')
      setPhase('verified_pending')
      controller.current = null
    }, 30000)

    const failBeforeLock = (message: string, reason: 'read_error' | 'wrong_tag' | 'wrong_url') => {
      if (lockStarted) return
      lockStarted = true
      clearTimeout(timeout)
      active.abort()
      removeStoredReceipt()
      void recordFailure(reason)
      setError(message)
      setPhase('verified_pending')
      controller.current = null
    }

    reader.onreadingerror = () => failBeforeLock('Não foi possível conferir a etiqueta no momento do bloqueio. Nenhum bloqueio foi solicitado.', 'read_error')
    reader.onreading = (event) => {
      if (lockStarted) return
      const observedSerial = serialFrom(event.serialNumber)
      if (observedSerial !== serial) {
        failBeforeLock('A etiqueta lida é diferente da conferida. Nenhum bloqueio foi solicitado.', 'wrong_tag')
        return
      }
      if (urlFrom(event) !== url) {
        failBeforeLock('O link lido diverge do link Tavvi conferido. Nenhum bloqueio foi solicitado.', 'wrong_url')
        return
      }

      // Web NFC recomenda iniciar o bloqueio dentro do evento reading para
      // validar o alvo antes de pedir a operação irreversível.
      const makeReadOnly = reader.makeReadOnly
      if (typeof makeReadOnly !== 'function') {
        failBeforeLock('Este aparelho não oferece bloqueio permanente. A etiqueta continua gravável.', 'read_error')
        setProtectionSupported(false)
        return
      }

      lockStarted = true
      clearTimeout(timeout)
      let locking: Promise<void>
      try {
        locking = makeReadOnly.call(reader, { signal: active.signal })
      } catch (cause) {
        void failProtection(cause, receipt, active)
        return
      }
      setPhase('locking')
      setError('')
      void locking.then(async () => {
        const applied: ProtectionReceipt = { ...receipt, status: 'applied', appliedAt: new Date().toISOString() }
        try {
          window.localStorage.setItem(protectionReceiptKey(tag.id), JSON.stringify(applied))
          setPendingReceipt(applied)
        } catch {
          setPendingReceipt(receipt)
          setError('O navegador confirmou o bloqueio, mas não conseguiu atualizar o recibo local. O painel tentará sincronizar agora.')
        }
        active.abort()
        controller.current = null
        await submitProtectedReceipt(applied)
      }).catch((cause) => failProtection(cause, receipt, active))
    }

    setPhase('awaiting_lock_target')
    setError('Aproxime a mesma etiqueta para conferir serial e link antes de bloqueá-la…')
    void reader.scan({ signal: active.signal }).catch((cause) => {
      if (!lockStarted) failBeforeLock(nfcErrorMessage(cause, 'Não foi possível iniciar a leitura para proteger a etiqueta.'), 'read_error')
    })
  }

  async function failProtection(cause: unknown, receipt: ProtectionReceipt, active: AbortController) {
    // Depois que makeReadOnly() foi invocado, um erro de transporte pode vir
    // após o chip já ter aplicado o bloqueio. Preserve o recibo para que a
    // retomada nunca trate uma etiqueta possivelmente bloqueada como gravável.
    try {
      window.localStorage.setItem(protectionReceiptKey(tag.id), JSON.stringify(receipt))
      setPendingReceipt(receipt)
      setReceiptConflict(false)
    } catch {
      setPendingReceipt(receipt)
      setReceiptConflict(true)
    }
    active.abort()
    controller.current = null
    await recordFailure('protection_error')
    setError(`O navegador não confirmou o bloqueio. O estado físico é incerto; não regrave a etiqueta. Leia-a novamente para retomar. ${nfcErrorMessage(cause, '')}`.trim())
    setPhase('verified_pending')
  }

  async function resumeReceipt() {
    if (!pendingReceipt || (phase !== 'idle' && phase !== 'verified_pending') || !supported) return
    setError('')
    setPhase('sync_reading')
    const active = new AbortController()
    controller.current = active
    try {
      const reading = await readOnce(active)
      if (serialFrom(reading.serialNumber) !== pendingReceipt.serial) {
        throw new Error('Esta não é a etiqueta do recibo de proteção. Nenhuma gravação foi feita.')
      }
      if (urlFrom(reading) !== pendingReceipt.url || pendingReceipt.url !== url) {
        throw new Error('O link lido diverge do recibo. Nenhuma gravação foi feita; peça revisão manual.')
      }
      setSerial(pendingReceipt.serial)
      setOperationId(pendingReceipt.operationId)
      setExistingUrl(pendingReceipt.url)
      if (pendingReceipt.status === 'attempting') {
        if (!protectionSupported) {
          setPhase('verified_pending')
          setError('A tentativa anterior foi interrompida. Retome em um aparelho com bloqueio NFC permanente.')
        } else {
          setPhase('verified_pending')
          setConfirmOpen(true)
          setError('A tentativa anterior pode ter sido interrompida durante o bloqueio. Confirme para retomar sem regravar a etiqueta.')
        }
      } else {
        await submitProtectedReceipt(pendingReceipt)
      }
    } catch (cause) {
      setError(nfcErrorMessage(cause, 'Não foi possível conferir o recibo NFC. A etiqueta não foi regravada.'))
      setPhase('idle')
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

  const busy = ['reading', 'writing', 'verifying', 'recording_verified', 'awaiting_lock_target', 'locking', 'sync_reading', 'syncing'].includes(phase)
  const protectedDate = tag.nfcProtectedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(tag.nfcProtectedAt))
    : null
  const receiptDate = pendingReceipt?.appliedAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(pendingReceipt.appliedAt))
    : null

  return <section className="tv-tag-nfc" aria-label="Etiqueta NFC">
    <div className="tv-tag-nfc-heading"><LuRadioTower aria-hidden="true" /><div><strong>Etiqueta NFC</strong><span>{tag.nfcProtectedAt ? `Bloqueio registrado · ${tag.nfcSerial}` : tag.nfcSerial ? `Vinculada · proteção pendente · ${tag.nfcSerial}` : 'Nenhuma etiqueta física vinculada'}</span></div></div>
    {tag.nfcVerifiedAt ? <p className="tv-tag-nfc-meta">Link conferido em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(tag.nfcVerifiedAt))}</p> : null}
    {tag.nfcProtectedAt ? <p className="tv-tag-nfc-success"><LuCheck aria-hidden="true" />O navegador registrou o bloqueio permanente em {protectedDate}. O link e o QR continuam ativos.</p> : null}
    {supported === false ? <p>Para ler e gravar, abra este painel no Chrome de um Android com NFC ativado. Depois de gravada, a URL pode ser lida também por iPhone.</p> : null}
    {supported && protectionSupported === false && !tag.nfcProtectedAt ? <p className="tv-tag-nfc-meta">Este aparelho permite gravar e conferir o link, mas não oferece bloqueio permanente. A proteção ficará pendente para retomada em outro aparelho compatível.</p> : null}
    {!tag.isActive ? <p>O link ficará indisponível para clientes enquanto este identificador estiver desativado.</p> : null}
    {!fitsNtag213 ? <p className="tv-tag-form-error">O link excede o espaço seguro estimado para uma NTAG213.</p> : null}

    {receiptConflict && !tag.nfcProtectedAt ? <p className="tv-tag-form-error" role="alert">Não foi possível ler ou salvar um recibo local de proteção coerente com este vínculo. Não regrave esta etiqueta; faça uma revisão manual em aparelho compatível.</p> : null}
    {pendingReceipt && !tag.nfcProtectedAt ? <>
      <p className="tv-tag-nfc-meta">{phase === 'awaiting_lock_target'
        ? 'Aguardando a etiqueta conferida para validar serial e link antes de bloquear…'
        : phase === 'locking'
          ? 'Bloqueio permanente em andamento. Mantenha a etiqueta junto ao aparelho e não feche esta tela…'
          : pendingReceipt.status === 'applied'
            ? `O navegador confirmou o bloqueio${receiptDate ? ` em ${receiptDate}` : ''}; falta sincronizar com o painel.`
            : 'Uma tentativa de bloqueio foi interrompida. O estado físico é incerto; a etiqueta não será regravada.'}</p>
      {supported && (phase === 'idle' || phase === 'verified_pending') && (pendingReceipt.status === 'applied' || protectionSupported) ? <button type="button" onClick={() => void resumeReceipt()}>{pendingReceipt.status === 'applied' ? 'Conferir etiqueta e sincronizar' : 'Ler etiqueta para retomar'}</button> : null}
      {supported && pendingReceipt.status === 'attempting' && !protectionSupported ? <p>Este aparelho consegue ler a etiqueta, mas não retomar o bloqueio. Abra este identificador em um Android compatível com bloqueio NFC permanente.</p> : null}
      {phase === 'sync_reading' ? <p>Aproxime a etiqueta do recibo para conferir serial e link…</p> : null}
      {phase === 'syncing' ? <p>Sincronizando a proteção com o painel…</p> : null}
    </> : null}

    {supported && fitsNtag213 && !tag.nfcProtectedAt && !pendingReceipt && !receiptConflict ? <>
      {phase === 'idle' ? <button type="button" onClick={() => void identify()}>{tag.nfcVerifiedAt ? 'Retomar proteção da etiqueta' : tag.nfcSerial ? 'Ler e conferir etiqueta' : 'Ler etiqueta'}</button> : null}
      {phase === 'reading' ? <p>Aproxime a etiqueta para ler o número de série…</p> : null}
      {phase === 'ready' && serial ? <>
        <p>Etiqueta {serial}. {existingUrl ? existingUrl === url ? 'O link Tavvi correto já está gravado.' : 'Há outro link gravado; ele será substituído pelo link Tavvi mostrado.' : 'Nenhum link de URL encontrado.'}</p>
        <div className="tv-tag-nfc-actions"><button type="button" onClick={() => void write()}>{existingUrl && existingUrl !== url ? 'Substituir pelo link Tavvi' : 'Gravar link Tavvi'}</button>{existingUrl === url ? <button type="button" onClick={() => void verify()}>Conferir link Tavvi</button> : null}</div>
      </> : null}
      {phase === 'writing' ? <p>Aproxime a etiqueta para gravar o link Tavvi…</p> : null}
      {phase === 'written' ? <><p>Gravação concluída. Aproxime a mesma etiqueta para conferir o número de série e o link.</p><button type="button" onClick={() => void verify()}>Conferir etiqueta</button></> : null}
      {phase === 'verifying' ? <p>Aproxime a mesma etiqueta para conferir número de série e link…</p> : null}
      {phase === 'recording_verified' ? <p>Conferência salva. Preparando a confirmação de bloqueio…</p> : null}
      {phase === 'verified_pending' ? <>
        <p>Link Tavvi conferido · proteção pendente.</p>
        {protectionSupported ? <button type="button" onClick={() => setConfirmOpen(true)}>Proteger contra regravação</button> : <p>Retome em um aparelho compatível para bloquear a gravação.</p>}
      </> : null}
      {phase === 'idle' && tag.nfcVerifiedAt && !tag.nfcProtectedAt ? <p>Link Tavvi conferido · proteção pendente. Leia a etiqueta para retomar o bloqueio permanente.</p> : null}
      {phase === 'awaiting_lock_target' ? <p>Aproxime a mesma etiqueta para validar o serial e o link antes do bloqueio…</p> : null}
      {phase === 'locking' ? <p>Bloqueio permanente em andamento. Mantenha a etiqueta junto ao aparelho e não feche esta tela…</p> : null}
      {phase === 'syncing' ? <p>Bloqueio confirmado pelo navegador. Sincronizando com o painel…</p> : null}
      {phase === 'done' ? <p className="tv-tag-nfc-success"><LuCheck aria-hidden="true" />Proteção registrada no painel.</p> : null}
      {phase !== 'idle' && !busy && phase !== 'done' && phase !== 'verified_pending' ? <button type="button" className="is-quiet" onClick={() => void restart()}>Começar com outra etiqueta</button> : null}
      {tag.nfcSerial && phase === 'idle' ? <p>Se trocar de etiqueta, descarte a anterior: o link nela continuará válido enquanto este identificador estiver ativo.</p> : null}
    </> : null}

    {error ? <p className="tv-tag-form-error" role="alert">{error}</p> : null}
    <button type="button" className="is-quiet" onClick={() => void toggleHistory()}>{historyOpen ? 'Ocultar histórico' : 'Ver histórico NFC'}</button>
    {historyOpen ? <div className="tv-tag-nfc-history" aria-live="polite">
      {historyBusy ? <p>Carregando histórico…</p> : history?.length === 0 ? <p>Sem operações NFC registradas.</p> : history?.map((event, index) => <div key={`${event.createdAt}-${index}`}>
        <strong>{event.action === 'started' ? 'Leitura iniciada' : event.action === 'verified' ? 'Link Tavvi conferido' : event.action === 'protected' ? 'Proteção permanente registrada' : event.action === 'routing_changed' ? 'Mesa ou disponibilidade alterada' : 'Operação não concluída'}</strong>
        <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(event.createdAt))}{event.serial ? ` · ${event.serial}` : ''}</span>
        {event.reason ? <span>{event.action === 'routing_changed' ? event.reason : `Motivo: ${failureLabels[event.reason] ?? event.reason}`}</span> : null}
        {event.actorId ? <span>Operador: {event.actorId.slice(0, 8)}</span> : null}
      </div>)}</div> : null}
    <PanelConfirm
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      icon={<LuRadioTower />}
      title="Proteger etiqueta contra regravação?"
      description="A proteção é permanente. Depois dela, o navegador deve impedir qualquer regravação — inclusive pelo Tavvi. O link continuará funcionando, e a mesa e a disponibilidade continuarão editáveis pelo painel."
      confirmLabel="Proteger"
      destructive
      onConfirm={startProtection}
    />
  </section>
}
