'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiquidPocket } from './use-liquid-pocket'

const M = 12
const R = 28
const FILLET = 18
const K = 0.45

export function pocketPath(W: number, H: number, L: number, cy: number, aT: number, aB: number, D: number) {
  const T = M
  const B = H - M
  const Rt = W - M
  const f = FILLET
  const x0 = L - D
  const r = Math.min(24, aT, aB)
  return [
    `M ${L + R} ${T}`, `H ${Rt - R}`, `C ${Rt - R * K} ${T} ${Rt} ${T + R * K} ${Rt} ${T + R}`,
    `V ${B - R}`, `C ${Rt} ${B - R * K} ${Rt - R * K} ${B} ${Rt - R} ${B}`,
    `H ${L + R}`, `C ${L + R * K} ${B} ${L} ${B - R * K} ${L} ${B - R}`,
    `V ${cy + aB + f}`, `C ${L} ${cy + aB + f * K} ${L - f * K} ${cy + aB} ${L - f} ${cy + aB}`,
    `H ${x0 + r}`, `C ${x0 + r * K} ${cy + aB} ${x0} ${cy + aB - r * K} ${x0} ${cy + aB - r}`,
    `V ${cy - aT + r}`, `C ${x0} ${cy - aT + r * K} ${x0 + r * K} ${cy - aT} ${x0 + r} ${cy - aT}`,
    `H ${L - f}`, `C ${L - f * K} ${cy - aT} ${L} ${cy - aT - f * K} ${L} ${cy - aT - f}`,
    `V ${T + R}`, `C ${L} ${T + R * K} ${L + R * K} ${T} ${L + R} ${T}`, 'Z',
  ].join(' ')
}

export function LiquidFrame({
  children,
  initialLeft,
  activeIndex,
  collapsedWidth,
  onReady,
}: {
  children: React.ReactNode
  initialLeft: number
  activeIndex: number
  collapsedWidth: number
  onReady: (moveTo: (left: number, cy: number, instant?: boolean) => void) => void
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [measured, setMeasured] = useState(false)
  const activeCy = 196 + 64 * activeIndex
  const getPath = useCallback(pocketPath, [])
  const pocket = useLiquidPocket({ initialLeft, initialCy: activeCy, getPath, pathRef, railRef, mainRef })
  const { snap, moveTo } = pocket

  useEffect(() => {
    const host = mainRef.current?.parentElement
    if (!host) return
    const observer = new ResizeObserver(([entry]) => {
      const mobile = window.matchMedia('(max-width: 767px)').matches
      snap(entry.contentRect.width, entry.contentRect.height, mobile ? 0 : initialLeft, activeCy)
      setMeasured(true)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [activeCy, initialLeft, snap])

  useEffect(() => onReady(moveTo), [onReady, moveTo])

  return (
    <div className="tv-console-frame">
      <svg className="tv-console-liquid" aria-hidden="true" style={{ opacity: measured ? 1 : 0 }}>
        <path ref={pathRef} d={pocketPath(1440, 900, initialLeft, activeCy, 28, 28, initialLeft - M)} />
      </svg>
      <aside ref={railRef} className="tv-console-rail-space" style={{ width: collapsedWidth }} />
      <div ref={mainRef} className="tv-console-main">{children}</div>
    </div>
  )
}
