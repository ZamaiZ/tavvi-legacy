'use client'

import { createContext, useContext } from 'react'

export type ServiceCallsRealtimeListener = (messages: unknown[]) => void

type ServiceCallsRealtimeContextValue = {
  subscribe: (listener: ServiceCallsRealtimeListener) => () => void
  updatePendingCount: (count: number) => void
  refreshPendingCount: () => Promise<void>
}

const ServiceCallsRealtimeContext = createContext<ServiceCallsRealtimeContextValue>({
  subscribe: () => () => undefined,
  updatePendingCount: () => undefined,
  refreshPendingCount: async () => undefined,
})

export function useServiceCallsRealtimeContext() {
  return useContext(ServiceCallsRealtimeContext)
}

export { ServiceCallsRealtimeContext }
