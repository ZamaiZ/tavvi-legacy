'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LuChevronLeft } from 'react-icons/lu'
import { toExternalPath } from '@/lib/route-paths'
import { clearStackedFromList, openedFromList } from '@/lib/viewport'

// Barra das telas empilhadas do console no celular (padrão iOS): voltar em
// dourado e, opcionalmente, o título centralizado. Desempilha quando a lista
// abriu esta tela; em qualquer outro caminho, substitui pela lista.
export function MobileNavBar({ backHref, backLabel, title }: { backHref: string; backLabel: string; title?: string }) {
  const router = useRouter()
  const pathname = toExternalPath(usePathname())
  return (
    <nav className="tv-m-navbar tv-m-only" aria-label="Navegação">
      <Link
        href={backHref}
        replace
        className="tv-m-back"
        onClick={(event) => {
          if (!openedFromList(pathname)) return
          event.preventDefault()
          clearStackedFromList()
          router.back()
        }}
      >
        <LuChevronLeft aria-hidden="true" />{backLabel}
      </Link>
      {title ? <h1 className="tv-m-navbar-title">{title}</h1> : null}
    </nav>
  )
}
