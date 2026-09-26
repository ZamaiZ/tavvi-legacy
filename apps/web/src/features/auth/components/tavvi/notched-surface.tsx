'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createNotchedPath } from '@/lib/notched-path'

export function NotchedSurface({ desktop = false, mark = true }: { desktop?: boolean; mark?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const rect = root.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const radius = desktop ? 32 : 28
  const path = size.width && size.height
    ? createNotchedPath({
        width: size.width,
        height: size.height,
        radius,
        notchW: 76,
        notchH: 72,
        curve: 22,
      })
    : ''

  const glowPosition = desktop ? '72% 62%' : '84% 82%'

  return (
    <div ref={rootRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: path ? `path('${path}')` : `inset(0 round ${radius}px)`,
          background: `radial-gradient(48% 64% at ${glowPosition}, var(--tv-hero-glow), transparent), linear-gradient(135deg, var(--tv-hero), var(--tv-hero-end))`,
        }}
      >
        {mark ? (
          <Image
            src="/brand/tavvi-brandmark.png"
            alt=""
            width={900}
            height={900}
            sizes={desktop ? '820px' : '252px'}
            className={desktop
              ? 'absolute -right-[60px] -bottom-[250px] h-[820px] w-[820px] max-w-none object-contain opacity-[0.16]'
              : 'absolute top-[66px] left-[calc(100%-172px)] h-[252px] w-[252px] max-w-none object-contain opacity-20'}
          />
        ) : null}
      </div>
      {path ? (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
        >
          <path d={path} fill="none" stroke="var(--tv-border)" strokeWidth="1" />
        </svg>
      ) : null}
    </div>
  )
}
