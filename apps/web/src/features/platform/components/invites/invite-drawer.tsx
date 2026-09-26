'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LuX } from 'react-icons/lu'
import type { PlatformInviteDTO } from '@/domain/invite'
import { InviteDetail } from './invite-detail'

export function InviteDrawer({ invite }: { invite: PlatformInviteDTO | null }) {
  const router = useRouter()
  const search = useSearchParams()
  function close() {
    const params = new URLSearchParams(search.toString())
    params.delete('convite')
    const value = params.toString()
    router.replace(`/${value ? `?${value}` : ''}`, { scroll: false })
  }
  if (!invite) return null
  return <>
    <button type="button" className="tv-drawer-scrim" aria-label="Fechar detalhe" onClick={close} />
    <aside role="dialog" aria-modal="true" aria-labelledby="tv-invite-drawer-title" className="tv-detail-drawer">
      <header><h2 id="tv-invite-drawer-title">Convite</h2><button type="button" className="tv-icon-button" aria-label="Fechar" onClick={close}><LuX /></button></header>
      <div className="tv-drawer-body"><InviteDetail invite={invite} /></div>
    </aside>
  </>
}
