'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { LuPlus } from 'react-icons/lu'
import { createNotchedPath } from '@/lib/notched-path'

export function ListHero({ title, description, mobileDescription, summary, action }: {
  title: string
  description: string
  mobileDescription?: string
  summary: string
  action?: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [actionSize, setActionSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const measure = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) setSize({ width: rect.width, height: rect.height })
      const actionRect = actionRef.current?.getBoundingClientRect()
      if (actionRect) setActionSize({ width: actionRect.width, height: actionRect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (ref.current) observer.observe(ref.current)
    if (actionRef.current) observer.observe(actionRef.current)
    return () => observer.disconnect()
  }, [])
  const notchW = action ? Math.min(size.width - 52, actionSize.width + 22) : 76
  const notchH = action ? actionSize.height + 18 : 72
  const path = size.width && size.height
    ? createNotchedPath({ width: size.width, height: size.height, radius: 30, notchW, notchH, curve: 22 })
    : ''
  return <div className="relative">
    <section ref={ref} className="tv-list-hero" style={path ? { clipPath: `path('${path}')` } : undefined}>
      <Image src="/brand/tavvi-brandmark.png" width={340} height={340} alt="" aria-hidden="true" className="tv-hero-watermark" />
      <div className="tv-hero-copy"><span className="tv-platform-pill"><i />Plataforma</span><div><h1>{title}<i>.</i></h1><p className="tv-hero-description">{description}</p><p className="tv-hero-description-mobile">{mobileDescription ?? description}</p></div></div>
      <div className="tv-hero-footer"><p>{summary}</p></div>
    </section>
    {action && <div ref={actionRef} className="tv-hero-action">{action}</div>}
  </div>
}

export function NewInviteButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="tv-new-invite" onClick={onClick}><span>Novo convite</span><i><LuPlus aria-hidden="true" /></i></button>
}
