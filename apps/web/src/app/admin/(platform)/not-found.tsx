import Link from 'next/link'
import { LuSearchX } from 'react-icons/lu'
import { StateCard } from '@/features/platform/components/state-card'

export default function NotFound() {
  return <main className="tv-error-page"><StateCard icon={<LuSearchX />} title="Página não encontrada" description="O endereço pode ter mudado ou não existe mais." action={<Link href="/" className="tv-secondary-cta">Voltar para Convites</Link>} /></main>
}
