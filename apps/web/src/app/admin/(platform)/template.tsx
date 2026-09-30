'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  useEffect(() => {
    document.querySelector<HTMLElement>('.tv-console-main')?.scrollTo({ top: 0 })
  }, [pathname])
  // No celular quem dá o recuo é cada tela (console-mobile.css) e o login
  // ocupa a tela inteira; do md para cima o recuo continua o mesmo.
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-[14px] md:px-6 md:pt-6 md:pb-8 lg:gap-0 lg:px-8 lg:pt-7 lg:pb-10">
      {children}
    </div>
  )
}
