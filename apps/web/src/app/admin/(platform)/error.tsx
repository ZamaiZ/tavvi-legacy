'use client'

import { LuTriangleAlert } from 'react-icons/lu'
import { RetryButton, StateCard } from '@/features/platform/components/state-card'

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="tv-error-page"><StateCard icon={<LuTriangleAlert />} title="Não foi possível carregar" description="Verifique sua conexão e tente novamente." action={<RetryButton onClick={reset} />} /></main>
}
