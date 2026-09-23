import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-client'
export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2, refetchOnReconnect: true }, mutations: { retry: false } } })
