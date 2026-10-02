import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_ROUTES, type NotificationCount, type NotificationCursor, type NotificationPage } from '@tavvi/api-contracts'
import { apiRequest } from '@/lib/api-client'
import { disableOnThisDevice, enableOnThisDevice, readDevicePushState } from './push'

// inbox = lista e contador: invalidar a chave atualiza os dois de uma vez.
export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: ['notifications', 'inbox'] as const,
  list: ['notifications', 'inbox', 'list'] as const,
  count: ['notifications', 'inbox', 'count'] as const,
  device: ['notifications', 'device'] as const,
}

export function markNotificationRead(id: string) {
  return apiRequest<{ read: true }>(API_ROUTES.notifications.read(id), { method: 'POST' })
}

export function useUnreadNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => apiRequest<NotificationPage>(API_ROUTES.notifications.list(pageParam ?? undefined)),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (last) => {
      const tail = last.items.at(-1)
      return last.hasMore && tail ? { createdAt: tail.createdAt, id: tail.id } : undefined
    },
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.count,
    queryFn: () => apiRequest<NotificationCount>(API_ROUTES.notifications.count),
    select: (data) => data.unread,
  })
}

export function useDevicePush() {
  return useQuery({ queryKey: notificationKeys.device, queryFn: readDevicePushState, staleTime: 0 })
}

function useRefreshInbox() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox })
}

export function useMarkRead() {
  const refresh = useRefreshInbox()
  return useMutation({ mutationFn: markNotificationRead, onSettled: refresh })
}

export function useMarkAllRead() {
  const refresh = useRefreshInbox()
  return useMutation({
    mutationFn: () => apiRequest<{ read: true }>(API_ROUTES.notifications.readAll, { method: 'POST' }),
    onSettled: refresh,
  })
}

// A notificação de teste já está no banco quando a API responde: a lista
// e o contador mostram na hora, mesmo com o push ainda a caminho.
export function useSendTestNotification() {
  const refresh = useRefreshInbox()
  return useMutation({
    mutationFn: () => apiRequest<{ sent: true }>(API_ROUTES.notifications.test, { method: 'POST' }),
    onSuccess: refresh,
  })
}

function useDeviceMutation(run: () => Promise<Awaited<ReturnType<typeof readDevicePushState>>>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (state) => queryClient.setQueryData(notificationKeys.device, state),
    // Permissão negada ou erro no meio do caminho: relê o estado real.
    onError: () => queryClient.invalidateQueries({ queryKey: notificationKeys.device }),
  })
}

export function useEnablePush() {
  return useDeviceMutation(enableOnThisDevice)
}

export function useDisablePush() {
  return useDeviceMutation(disableOnThisDevice)
}
