'use client'

import { useEffect, useRef } from 'react'

export function useCallArrivalShake<T extends HTMLElement>(arrivalKey: number) {
  const elementRef = useRef<T>(null)
  const previousKey = useRef(arrivalKey)

  useEffect(() => {
    const isNewArrival = arrivalKey > previousKey.current
    previousKey.current = arrivalKey
    if (!isNewArrival || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animation = elementRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(-2px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(.77,0,.175,1)' },
    )
    return () => animation?.cancel()
  }, [arrivalKey])

  return elementRef
}
