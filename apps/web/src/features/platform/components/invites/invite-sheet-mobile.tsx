'use client'

import { LuArrowRight, LuCheck, LuCopy, LuMail, LuMinus, LuPlus, LuTriangleAlert } from 'react-icons/lu'
import type { InviteSheetState } from './use-invite-sheet'

// Sheet do iOS (print novo-convite): alça, "Cancelar · título", grupos e o
// CTA preso embaixo. Ao gerar novo link, o prazo é o do convite anterior,
// então a linha Validade não aparece.
export function InviteSheetMobile({ sheet }: { sheet: InviteSheetState }) {
  return <>
    <header className="tv-sheet-m-head">
      <span className="tv-sheet-m-handle" aria-hidden="true" />
      <div className="tv-sheet-m-nav">
        <button type="button" className="tv-sheet-m-cancel" disabled={sheet.pending} onClick={sheet.requestClose}>Cancelar</button>
        <h2>{sheet.rotating ? 'Novo link' : 'Novo convite'}</h2>
        <span aria-hidden="true" />
      </div>
    </header>
    {sheet.link ? (
      <div className="tv-sheet-m-body">
        <div className="tv-sheet-m-done"><span><LuCheck aria-hidden="true" /></span><h3>Convite criado</h3><p>Copie agora. O link não será exibido novamente.</p></div>
        <div className="tv-sheet-m-link tv-mono" ref={sheet.linkRef} tabIndex={0}>{sheet.link}</div>
        <div className="tv-sheet-m-warning"><LuTriangleAlert aria-hidden="true" /><span>Se você fechar sem copiar, terá que emitir outro convite.</span></div>
        {sheet.error ? <p role="alert" className="tv-sheet-m-error">{sheet.error}</p> : null}
        <div className="tv-sheet-m-spacer" />
        <button type="button" className="tv-m-pill is-secondary" onClick={sheet.copyLink}>{sheet.copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}{sheet.copied ? 'Link copiado' : 'Copiar link'}</button>
        <button type="button" className="tv-m-pill is-primary tv-sheet-m-cta" disabled={!sheet.copied} onClick={sheet.done}>Já copiei o link</button>
      </div>
    ) : (
      <div className="tv-sheet-m-body">
        <p className="tv-sheet-m-lead">{sheet.rotating ? 'O link atual deixa de funcionar e um novo é gerado para o mesmo destinatário e prazo.' : 'Crie um acesso de administrador da plataforma.'}</p>
        {sheet.error ? <p role="alert" className="tv-sheet-m-error">{sheet.error}</p> : null}
        <label className="tv-sheet-m-field">
          <LuMail aria-hidden="true" />
          <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" aria-label="E-mail (opcional)" placeholder="E-mail (opcional)" value={sheet.email} readOnly={sheet.rotating} onChange={(event) => sheet.setEmail(event.target.value)} />
        </label>
        {!sheet.rotating ? <p className="tv-sheet-m-note">Preenchido, o link só funciona para quem entrar com esse e-mail.</p> : null}
        {!sheet.rotating ? <>
          <div className="tv-sheet-m-validity">
            <span>Validade</span>
            <output aria-live="polite">{sheet.days} {sheet.days === 1 ? 'dia' : 'dias'}</output>
            <span className="tv-sheet-m-stepper">
              <button type="button" aria-label="Menos dias" disabled={sheet.days <= 1} onPointerDown={() => sheet.startHold(-1)} onPointerUp={sheet.stopHold} onPointerLeave={sheet.stopHold} onClick={() => sheet.stepDays(-1)}><LuMinus aria-hidden="true" /></button>
              <i aria-hidden="true" />
              <button type="button" aria-label="Mais dias" disabled={sheet.days >= 30} onPointerDown={() => sheet.startHold(1)} onPointerUp={sheet.stopHold} onPointerLeave={sheet.stopHold} onClick={() => sheet.stepDays(1)}><LuPlus aria-hidden="true" /></button>
            </span>
          </div>
          <p className="tv-sheet-m-note">Entre 1 e 30 dias. Quem aceitar dentro do prazo não perde o acesso depois.</p>
        </> : null}
        <div className="tv-sheet-m-spacer" />
        <button type="button" className="tv-m-pill is-primary tv-sheet-m-cta" disabled={sheet.pending} onClick={sheet.submit}>
          {sheet.pending ? <><span className="tv-spinner" />Gerando…</> : <>{sheet.rotating ? 'Gerar novo link' : 'Gerar link'}<LuArrowRight aria-hidden="true" /></>}
        </button>
      </div>
    )}
  </>
}
