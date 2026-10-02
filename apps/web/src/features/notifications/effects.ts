import type { NotificationDTO, NotificationTerritory } from '@/domain/notification'

export type NotificationEffectContext = {
  territory: NotificationTerritory
  /** Caminho EXTERNO atual (/restaurantes/…). */
  pathname: string
  /** Restaurante aberto no painel; nulo no console. */
  restaurantId: string | null
  refresh: () => void
  adjustUnreadFeedback: (delta: number) => void
}

function isUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

// O que muda na tela quando chega uma notificação, além do toast e do
// contador da central. Um lugar só, por tipo e por território: um kind novo
// ganha aqui a reação dele, sem espalhar condições pela casca.
export function onNotificationInserted(notification: NotificationDTO, context: NotificationEffectContext) {
  switch (notification.kind) {
    case 'feedback_received': {
      if (context.territory !== 'painel' || notification.restaurantId !== context.restaurantId) return
      context.adjustUnreadFeedback(1)
      if (isUnder(context.pathname, `/restaurantes/${context.restaurantId}/feedbacks`)) context.refresh()
      return
    }
    case 'team_member_joined': {
      if (context.territory !== 'painel' || notification.restaurantId !== context.restaurantId) return
      if (isUnder(context.pathname, `/restaurantes/${context.restaurantId}/equipe`)) context.refresh()
      return
    }
    case 'restaurant_joined': {
      // Lista de Restaurantes e contadores da barra lateral do console.
      if (context.territory === 'admin') context.refresh()
      return
    }
    case 'test':
      // O toast e a central já são o resultado do teste.
      return
  }
}

// Notificação apagada: hoje, só quando outro admin exclui o feedback. Se a
// tela de Feedbacks estiver aberta, ela relê a lista e o contador.
export function onNotificationRemoved(notification: NotificationDTO, context: NotificationEffectContext) {
  if (notification.kind !== 'feedback_received') return
  if (context.territory !== 'painel' || notification.restaurantId !== context.restaurantId) return
  context.refresh()
}
