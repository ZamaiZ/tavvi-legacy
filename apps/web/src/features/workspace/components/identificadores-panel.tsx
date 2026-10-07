'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { LuArrowRight, LuCheck, LuCircleAlert, LuCopy, LuLink, LuPencil, LuQrCode } from 'react-icons/lu'
import { MobileSheet, MobileSheetNav, useMobileSheet, useSheetBusy, useSheetGuard } from '@/components/shell/mobile-sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SpinnerRing } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import type { TagDTO } from '@/domain/tag'
import { createTagAction, updateTagAction } from '@/server/actions/tags'
import { PanelConfirm } from './panel-confirm'
import { lastSeen, tagName, tagPublicUrl } from './identificadores-utils'

export type TagPanelState = { mode: 'create' } | { mode: 'details' | 'edit'; tagId: string }

type PanelProps = {
  panel: TagPanelState
  tag: TagDTO | null
  restaurantId: string
  mobile: boolean
  onClose: () => void
  onEdit: () => void
  onSaved: (tag: TagDTO, created: boolean) => void
}

function useTagForm({ panel, tag, restaurantId, onSaved }: PanelProps) {
  const [number, setNumber] = useState(tag?.tableNumber?.toString() ?? '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const dirty = panel.mode === 'create' ? number.trim() !== '' : panel.mode === 'edit' && number.trim() !== (tag?.tableNumber?.toString() ?? '')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const raw = number.trim()
    const tableNumber = raw === '' && panel.mode === 'edit' ? null : Number(raw)
    if (!raw && panel.mode === 'create') { setError('Informe o número da mesa.'); return }
    if (tableNumber !== null && (!Number.isInteger(tableNumber) || tableNumber < 1)) { setError('Use um número de mesa inteiro maior que zero.'); return }
    setError('')
    startTransition(async () => {
      try {
        if (panel.mode === 'create') {
          const result = await createTagAction({ restaurantId, tableNumber })
          if (!result.ok) { setError(result.error); return }
          onSaved(result.data, true)
          toast.add({ title: `Identificador da mesa ${tableNumber} criado`, type: 'success' })
        } else if (panel.mode === 'edit' && tag) {
          const result = await updateTagAction({ tagId: tag.id, tableNumber, isActive: tag.isActive })
          if (!result.ok) { setError(result.error); return }
          onSaved({ ...tag, tableNumber }, false)
          toast.add({ title: tableNumber ? `Mesa ${tableNumber} atualizada` : 'Número da mesa removido', type: 'success' })
        }
      } catch {
        setError('Não foi possível salvar agora. Suas alterações continuam aqui; tente novamente.')
      }
    })
  }

  return { number, setNumber, error, setError, pending, dirty, submit }
}

type TagForm = ReturnType<typeof useTagForm>

function FormFields({ form, mode, autoFocus }: { form: TagForm; mode: 'create' | 'edit'; autoFocus: boolean }) {
  return <>
    <label className="tv-tag-form-field"><span>Número da mesa</span><input type="number" min="1" step="1" inputMode="numeric" value={form.number} onChange={(event) => { form.setNumber(event.target.value); form.setError('') }} aria-invalid={!!form.error} aria-describedby={form.error ? 'tv-tag-form-error' : undefined} placeholder="Ex.: 08" disabled={form.pending} autoFocus={autoFocus} /></label>
    {form.error ? <p id="tv-tag-form-error" className="tv-tag-form-error" role="alert">{form.error}</p> : null}
    <p className="tv-tag-form-help"><LuLink aria-hidden="true" />{mode === 'create' ? 'O link será único e continuará igual se você mudar a mesa depois.' : 'Mudar o número da mesa não altera o link já distribuído.'}</p>
  </>
}

export function TagPanel(props: PanelProps) {
  const form = useTagForm(props)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const formId = useId()

  function requestClose() {
    if (form.pending) return
    if (form.dirty) setDiscardOpen(true)
    else props.onClose()
  }

  async function copy() {
    const tag = props.tag
    if (!tag) return
    try {
      await navigator.clipboard.writeText(tagPublicUrl(tag))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      toast.add({ title: `Link da ${tagName(tag).toLowerCase()} copiado`, type: 'success' })
    } catch {
      toast.add({ title: 'Não foi possível copiar o link neste navegador.', type: 'error' })
    }
  }

  const details = props.tag ? <div className="tv-tag-details">
    <div className="tv-tag-details-hero"><span className="tv-tag-details-mark"><LuQrCode aria-hidden="true" /></span><div><strong>{tagName(props.tag)}</strong><span>{props.tag.isActive ? 'Identificador ativo' : 'Identificador desativado'}</span></div></div>
    <div className="tv-tag-details-group"><div><span>Último acesso</span><strong>{lastSeen(props.tag)}</strong></div><div><span>Link permanente</span><code>{tagPublicUrl(props.tag)}</code></div></div>
    {!props.tag.tableNumber ? <p className="tv-tag-details-note"><LuCircleAlert aria-hidden="true" />Defina a mesa antes de usar este identificador para chamados.</p> : null}
    <div className="tv-tag-details-actions"><button type="button" className="is-primary" onClick={() => void copy()}>{copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}{copied ? 'Link copiado' : 'Copiar link'}</button><button type="button" onClick={props.onEdit}><LuPencil aria-hidden="true" />Editar mesa</button></div>
  </div> : null

  const fields = <form id={formId} className="tv-tag-form" onSubmit={form.submit} noValidate aria-busy={form.pending || undefined}>
    {props.mobile ? <p className="tv-sheet-m-lead">{props.panel.mode === 'create' ? 'Associe um identificador a uma mesa. O link ficará pronto para copiar.' : 'Altere o número sem precisar refazer o link da mesa.'}</p> : null}
    <FormFields form={form} mode={props.panel.mode === 'create' ? 'create' : 'edit'} autoFocus={!props.mobile} />
  </form>

  if (props.mobile) return <MobileSheet open onOpenChange={(open) => { if (!open) requestClose() }}>
    <SheetContent props={props} form={form} formId={formId} details={details} fields={fields} discardOpen={discardOpen} setDiscardOpen={setDiscardOpen} />
  </MobileSheet>

  const title = props.panel.mode === 'create' ? 'Novo identificador' : props.panel.mode === 'edit' ? `Editar ${props.tag ? tagName(props.tag).toLowerCase() : 'identificador'}` : 'Detalhes do identificador'
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) requestClose() }} disablePointerDismissal={form.pending}>
      <DialogContent className="tv-tag-dialog" showCloseButton={false} aria-busy={form.pending || undefined}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{props.panel.mode === 'details' ? 'Consulte o acesso desta mesa e prepare o link.' : props.panel.mode === 'create' ? 'Associe um novo identificador a uma mesa.' : 'O link continuará o mesmo após salvar.'}</DialogDescription></DialogHeader>
        {props.panel.mode === 'details' ? details : fields}
        <DialogFooter className="tv-tag-dialog-footer"><button type="button" className="tv-tag-dialog-cancel" disabled={form.pending} onClick={requestClose}>{props.panel.mode === 'details' ? 'Fechar' : 'Cancelar'}</button>{props.panel.mode !== 'details' ? <button type="submit" form={formId} className="tv-tag-dialog-save" disabled={form.pending || (props.panel.mode === 'edit' && !form.dirty)}>{form.pending ? <SpinnerRing decorative /> : <LuArrowRight aria-hidden="true" />}{form.pending ? props.panel.mode === 'create' ? 'Criando…' : 'Salvando…' : props.panel.mode === 'create' ? 'Criar identificador' : 'Salvar alterações'}</button> : null}</DialogFooter>
      </DialogContent>
    </Dialog>
    <PanelConfirm open={discardOpen} onOpenChange={setDiscardOpen} icon={<LuCircleAlert />} title="Descartar alterações?" description={props.panel.mode === 'create' ? 'O número digitado será perdido.' : 'O número da mesa voltará ao valor anterior.'} confirmLabel="Descartar" cancelLabel="Continuar editando" destructive onConfirm={props.onClose} />
  </>
}

function SheetContent({ props, form, formId, details, fields, discardOpen, setDiscardOpen }: { props: PanelProps; form: TagForm; formId: string; details: React.ReactNode; fields: React.ReactNode; discardOpen: boolean; setDiscardOpen: (value: boolean) => void }) {
  const { forceClose } = useMobileSheet()
  useSheetBusy(form.pending)
  useSheetGuard(() => { if (form.pending) return false; if (form.dirty) { setDiscardOpen(true); return false }; return true })
  const title = props.panel.mode === 'create' ? 'Novo identificador' : props.panel.mode === 'edit' ? 'Editar mesa' : 'Identificador'
  return <>
    <MobileSheetNav title={title} action={props.panel.mode === 'details' ? undefined : { label: props.panel.mode === 'create' ? 'Criar' : 'Salvar', pendingLabel: props.panel.mode === 'create' ? 'Criando…' : 'Salvando…', form: formId, pending: form.pending, disabled: props.panel.mode === 'edit' && !form.dirty }} />
    {props.panel.mode === 'details' ? details : fields}
    <PanelConfirm open={discardOpen} onOpenChange={setDiscardOpen} icon={<LuCircleAlert />} title="Descartar alterações?" description={props.panel.mode === 'create' ? 'O número digitado será perdido.' : 'O número da mesa voltará ao valor anterior.'} confirmLabel="Descartar" cancelLabel="Continuar editando" destructive onConfirm={forceClose} />
  </>
}
