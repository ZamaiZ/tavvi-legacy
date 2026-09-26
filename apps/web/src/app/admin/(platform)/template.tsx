'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mainRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.querySelector<HTMLElement>('.tv-console-main')?.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div
      ref={mainRef}
      className="mx-auto flex w-full max-w-[1320px] flex-col gap-[14px] px-[18px] pt-[18px] pb-[calc(118px+env(safe-area-inset-bottom))] md:px-6 md:pt-6 md:pb-8 lg:gap-0 lg:px-8 lg:pt-7 lg:pb-10"
    >
      {children}
    </div>
  )
}
