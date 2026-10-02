import { ConsoleSignInShell } from '@/features/auth/components/tavvi/console-sign-in-shell'

export default function Loading() {
  return (
    <ConsoleSignInShell>
      <div className="tv-cl-form" aria-busy="true" aria-label="Carregando">
        <span className="tv-skeleton tv-cl-skeleton is-title" />
        <span className="tv-skeleton tv-cl-skeleton is-label" />
        <span className="tv-skeleton tv-cl-skeleton" />
        <span className="tv-skeleton tv-cl-skeleton is-label" />
        <span className="tv-skeleton tv-cl-skeleton" />
        <span className="tv-skeleton tv-cl-skeleton is-cta" />
      </div>
    </ConsoleSignInShell>
  )
}
