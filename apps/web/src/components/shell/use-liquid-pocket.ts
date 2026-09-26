'use client'

import { useCallback, useEffect, useRef } from 'react'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function useLiquidPocket({
  initialLeft,
  initialCy,
  getPath,
  pathRef,
  railRef,
  mainRef,
}: {
  initialLeft: number
  initialCy: number
  getPath: (width: number, height: number, left: number, cy: number, aT: number, aB: number, depth: number) => string
  pathRef: React.RefObject<SVGPathElement | null>
  railRef: React.RefObject<HTMLElement | null>
  mainRef: React.RefObject<HTMLElement | null>
}) {
  const sim = useRef({
    width: 1440,
    height: 900,
    left: initialLeft,
    targetLeft: initialLeft,
    cy: initialCy,
    targetCy: initialCy,
    velocityLeft: 0,
    velocityCy: 0,
    lastTime: 0,
    accumulator: 0,
    frame: 0,
  })

  const paint = useCallback(() => {
    const state = sim.current
    const path = pathRef.current
    if (!path) return
    const depth = state.left - 12 - clamp(Math.abs(state.velocityCy) * 0.035, 0, 24)
    const aT = 28 + clamp(state.velocityCy * 0.05, 0, 34)
    const aB = 28 + clamp(-state.velocityCy * 0.05, 0, 34)
    path.setAttribute('d', getPath(state.width, state.height, state.left, state.cy, aT, aB, depth))
    if (railRef.current) railRef.current.style.width = `${state.left}px`
    if (mainRef.current) mainRef.current.style.left = `${state.left}px`
  }, [getPath, mainRef, pathRef, railRef])

  const moveTo = useCallback((left: number, cy: number, instant = false) => {
    const state = sim.current
    state.targetLeft = left
    state.targetCy = cy
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off') {
      state.left = left
      state.cy = cy
      state.velocityLeft = 0
      state.velocityCy = 0
      paint()
      return
    }
    if (!state.frame) state.frame = requestAnimationFrame(step)
  }, [paint])

  const step = useCallback((time: number) => {
    const state = sim.current
    const elapsed = state.lastTime ? Math.min(0.05, (time - state.lastTime) / 1000) : 0
    state.lastTime = time
    state.accumulator += elapsed
    const stepSize = 1 / 120
    while (state.accumulator >= stepSize) {
      const ax = 320 * (state.targetLeft - state.left) - 35 * state.velocityLeft
      const ay = 190 * (state.targetCy - state.cy) - 15.5 * state.velocityCy
      state.velocityLeft += ax * stepSize
      state.velocityCy += ay * stepSize
      state.left += state.velocityLeft * stepSize
      state.cy += state.velocityCy * stepSize
      state.accumulator -= stepSize
    }
    paint()
    if (Math.abs(state.targetLeft - state.left) < 0.2 && Math.abs(state.velocityLeft) < 0.8 && Math.abs(state.targetCy - state.cy) < 0.2 && Math.abs(state.velocityCy) < 0.8) {
      state.left = state.targetLeft
      state.cy = state.targetCy
      state.velocityLeft = 0
      state.velocityCy = 0
      state.lastTime = 0
      state.frame = 0
      paint()
      return
    }
    state.frame = requestAnimationFrame(step)
  }, [paint])

  useEffect(() => () => cancelAnimationFrame(sim.current.frame), [])

  return {
    moveTo,
    snap: useCallback((width: number, height: number, left: number, cy: number) => {
      const state = sim.current
      cancelAnimationFrame(state.frame)
      state.frame = 0
      state.width = width
      state.height = height
      state.left = left
      state.targetLeft = left
      state.cy = cy
      state.targetCy = cy
      state.velocityLeft = 0
      state.velocityCy = 0
      paint()
    }, [paint]),
  }
}
