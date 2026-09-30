'use client'

import { LuTriangleAlert } from 'react-icons/lu'
import { useIsMobile } from '@/hooks/use-mobile'
import { ConfirmDialog } from '../confirm-dialog'
import { InviteSheetDesktop } from './invite-sheet-desktop'
import { InviteSheetMobile } from './invite-sheet-mobile'
import { useInviteSheet, type InviteSheetRequest } from './use-invite-sheet'

export type { InviteSheetRequest }

// O sheet só existe depois de uma ação do usuário (nunca vem do servidor),
// então escolher a visão por largura de tela não causa salto na hidratação.
export function InviteSheet({ request, onClose }: { request: InviteSheetRequest | null; onClose: () => void }) {
  const sheet = useInviteSheet(request, onClose)
  const mobile = useIsMobile()
  if (!request) return null
  const label = sheet.link ? 'Link do convite' : sheet.rotating ? 'Novo link' : 'Novo convite'
  return <>
    <button className="tv-sheet-scrim" aria-label="Fechar novo convite" onClick={sheet.requestClose} />
    <section role="dialog" aria-modal="true" aria-label={label} className={`tv-invite-sheet${mobile ? ' is-mobile' : ''}`}>
      {mobile ? <InviteSheetMobile sheet={sheet} /> : <InviteSheetDesktop sheet={sheet} />}
    </section>
    {sheet.discard && <ConfirmDialog title="Descartar link?" description="Esse link é exibido uma única vez." confirmLabel="Descartar" cancelLabel="Voltar ao link" icon={<LuTriangleAlert />} iconTone="accent" destructive onCancel={() => sheet.setDiscard(false)} onConfirm={sheet.discardLink} />}
  </>
}
