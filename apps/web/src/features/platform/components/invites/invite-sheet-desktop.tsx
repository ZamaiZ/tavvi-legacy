'use client'

import { LuArrowRight, LuCheck, LuCopy, LuMail, LuMinus, LuPlus, LuTriangleAlert, LuX } from 'react-icons/lu'
import { SpinnerRing } from '@/components/ui/spinner'
import { PrimaryCTA } from '../buttons'
import type { InviteSheetState } from './use-invite-sheet'

// Painel lateral do desktop. Mesmo markup de antes da separação em visões.
export function InviteSheetDesktop({ sheet }: { sheet: InviteSheetState }) {
  return <>
    <header><button type="button" className="tv-icon-button" aria-label="Fechar" disabled={sheet.pending} onClick={sheet.requestClose}><LuX /></button></header>
    {sheet.link ? <div className="tv-invite-sheet-body tv-created-state">
      <div className="tv-created-heading"><span><LuCheck /></span><div><h2>Convite criado<i>.</i></h2><p>Copie agora. O link não será exibido novamente.</p></div></div>
      <div className="tv-warning-box"><LuTriangleAlert /><span>O sistema guarda apenas uma marca deste link, e não consegue reconstruí-lo. Se você fechar sem copiar, terá que emitir outro convite.</span></div>
      <div className="tv-created-link tv-mono" ref={sheet.linkRef} tabIndex={0}>{sheet.link}</div>
      <button type="button" className={`tv-copy-button${sheet.copied ? ' is-copied' : ''}`} onClick={sheet.copyLink}>{sheet.copied ? <LuCheck /> : <LuCopy />}{sheet.copied ? 'Link copiado' : 'Copiar link'}</button>
      {sheet.error && <p role="alert" className="tv-field-error">{sheet.error}</p>}
      <PrimaryCTA disabled={!sheet.copied} onClick={sheet.done}>Já copiei o link<LuArrowRight /></PrimaryCTA>
    </div> : <div className="tv-invite-sheet-body">
      <h2>{sheet.rotating ? 'Novo link' : 'Novo convite'}<i>.</i></h2>
      <p className="tv-form-description">{sheet.rotating ? 'O link atual deixa de funcionar e um novo é gerado para o mesmo destinatário e prazo.' : 'Crie um acesso de restaurante.'}</p>
      {sheet.error && <p role="alert" className="tv-field-error">{sheet.error}</p>}
      <label className="tv-field-label" htmlFor="tv-invite-email">E-mail (opcional)</label>
      <div className="tv-input-wrap"><LuMail /><input id="tv-invite-email" type="email" value={sheet.email} readOnly={sheet.rotating || sheet.pending} aria-busy={sheet.pending || undefined} placeholder="Qualquer e-mail" onChange={(event) => sheet.setEmail(event.target.value)} /></div>
      {!sheet.rotating && <p className="tv-field-help">Preenchido, o link só funciona para quem entrar com esse e-mail.</p>}
      <label className="tv-field-label" htmlFor="tv-invite-days">Validade</label>
      <div className={`tv-stepper${sheet.rotating ? ' is-disabled' : ''}`}>
        <button type="button" aria-label="Menos dias" disabled={sheet.pending || sheet.rotating || sheet.days <= 1} onPointerDown={() => sheet.startHold(-1)} onPointerUp={sheet.stopHold} onPointerLeave={sheet.stopHold} onClick={() => sheet.stepDays(-1)}><LuMinus /></button>
        <output id="tv-invite-days">{sheet.rotating ? `Validade: ${sheet.days} dias` : `${sheet.days} ${sheet.days === 1 ? 'dia' : 'dias'}`}</output>
        <button type="button" aria-label="Mais dias" disabled={sheet.pending || sheet.rotating || sheet.days >= 30} onPointerDown={() => sheet.startHold(1)} onPointerUp={sheet.stopHold} onPointerLeave={sheet.stopHold} onClick={() => sheet.stepDays(1)}><LuPlus /></button>
      </div>
      <p className="tv-field-help">Escolha entre 1 e 30 dias. Depois desse prazo o link para de funcionar e você emite outro. Quem aceitar dentro do prazo não perde o acesso depois.</p>
      <PrimaryCTA disabled={sheet.pending} data-busy={sheet.pending} onClick={sheet.submit}>{sheet.pending ? <><SpinnerRing decorative />Gerando…</> : <>{sheet.rotating ? 'Gerar novo link' : 'Gerar link'}<LuArrowRight /></>}</PrimaryCTA>
    </div>}
  </>
}
