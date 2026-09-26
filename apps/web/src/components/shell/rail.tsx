'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { toExternalPath } from '@/lib/route-paths'
import { LuBookOpen, LuContact, LuMail, LuPalette, LuPanelLeftClose, LuSearch, LuStore, LuUsers } from 'react-icons/lu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ConsoleLeaf } from './console-config'
import { getActiveConsoleLeaf } from './console-config'
import { setRailMode, type RailMode } from './rail-store'

const ICONS = { mail: LuMail, store: LuStore, menu: LuBookOpen, palette: LuPalette, contact: LuContact, team: LuUsers } as const

function PendingRing() {
  const { pending } = useLinkStatus()
  return <span aria-hidden="true" className={`tv-link-pending${pending ? ' is-pending' : ''}`} />
}

export function Rail({
  leaves,
  mode,
  email,
  userDescription,
  contextLabel,
  contextDescription,
  onSearch,
  onAccount,
  onNavigate,
}: {
  leaves: ConsoleLeaf[]
  mode: RailMode
  email: string | null
  userDescription: string | null
  contextLabel: string | null
  contextDescription: string | null
  onSearch: () => void
  onAccount: () => void
  onNavigate: (leaf: ConsoleLeaf) => void
}) {
  const pathname = usePathname()
  const activeLeaf = getActiveConsoleLeaf(toExternalPath(pathname), leaves)
  const expanded = mode === 'pinned'
  return (
    <aside className={`tv-console-rail${expanded ? ' is-pinned' : ''}`}>
      <div className="tv-rail-brand">
        <span className="tv-brand-tile"><img src="/brand/tavvi-brandmark.png" alt="" /></span>
        {expanded && <span className="tv-brand-copy"><small>{contextLabel ?? 'TAVVI'}</small><strong>{contextDescription ?? 'Console'}</strong></span>}
      </div>
      <button type="button" onClick={onSearch} className="tv-rail-search" aria-label="Buscar página" title={!expanded ? 'Buscar página' : undefined}><LuSearch />{expanded && <><span>Buscar página</span><kbd>Ctrl + K</kbd></>}</button>
      <div className="tv-rail-divider" />
      <nav
        aria-label="Navegação principal"
        className="absolute top-[168px] left-2 right-2 flex flex-col gap-2"
      >
        {leaves.map((leaf) => {
          const Icon = ICONS[leaf.icon]
          const active = activeLeaf?.key === leaf.key
          const link = (
            <Link href={leaf.href} onClick={() => onNavigate(leaf)} aria-current={active ? 'page' : undefined} aria-label={!expanded ? leaf.label : undefined} className={`tv-rail-link${active ? ' is-active' : ''}`}>
              <span className="tv-rail-icon"><Icon aria-hidden="true" /></span>
              {expanded && <span className="tv-rail-link-label"><strong>{leaf.label}</strong><small>{leaf.sub}</small></span>}
              <PendingRing />
            </Link>
          )
          return (
            <Tooltip key={leaf.key}>
              <TooltipTrigger render={<span className="tv-rail-tooltip-trigger" />}>
                {link}
              </TooltipTrigger>
              <TooltipContent side="right">
                {leaf.sub ? `${leaf.label} — ${leaf.sub}` : leaf.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
      <div className="tv-rail-bottom">
        <button type="button" className="tv-rail-control" aria-label={expanded ? 'Recolher menu' : 'Fixar menu aberto'} onClick={() => setRailMode(expanded ? 'collapsed' : 'pinned')}><LuPanelLeftClose className={!expanded ? 'is-mirrored' : ''} />{expanded && <><span>Recolher menu</span><kbd>Ctrl + B</kbd></>}</button>
        <button type="button" className={`tv-rail-account${expanded ? ' is-expanded' : ''}`} aria-label={`Conta${email ? `: ${email}` : ''}`} onClick={onAccount}><span className="tv-rail-initial">{email?.trim().slice(0, 1).toUpperCase() || 'A'}</span>{expanded && <span className="tv-rail-link-label"><strong>{email ?? 'Conta'}</strong><small>{userDescription ?? 'Administrador da plataforma'}</small></span>}</button>
      </div>
    </aside>
  )
}
