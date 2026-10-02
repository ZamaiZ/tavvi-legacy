'use client'

import { MobileSheet, MobileSheetNav } from '@/components/shell/mobile-sheet'
import { PwaNotificationsAction } from '@/components/pwa/pwa-notifications-action'
import { NotificationList } from './notification-list'

// Central no celular do painel, aberta pela linha "Notificações" de
// Ajustes. O console usa a subtela da folha Conta, que tem estilo próprio.
export function NotificationCenterSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <MobileSheetNav title="Notificações" cancelLabel="Fechar" />
      <div className="tv-notif-sheet">
        <PwaNotificationsAction variant="row" label="Neste aparelho" />
        <NotificationList onNavigate={() => onOpenChange(false)} />
      </div>
    </MobileSheet>
  )
}
