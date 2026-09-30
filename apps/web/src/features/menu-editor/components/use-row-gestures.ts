'use client'

import { useRef, type MouseEvent, type PointerEvent } from 'react'

const HOLD_MS = 480
const SLOP = 10

// Toque numa linha do cardápio: segurar PARADO 480 ms abre o menu do item;
// deslizar à direita alterna a disponibilidade; à esquerda pede para
// excluir. Por Pointer Events: quando o navegador assume o toque para rolar
// ou puxar para atualizar, ele manda `pointercancel` e o gesto morre ali (o
// `touchmove` não servia: durante a rolagem ele chega atrasado, e o segurar
// disparava no meio do scroll). A linha tem `touch-action: pan-y`, então só
// o arrasto horizontal chega até aqui. Qualquer rolagem durante o segurar
// também cancela. Depois de um gesto, o toque não vira clique.
export function useRowGestures({
  enabled,
  ignore = 'button,input,[role="switch"],a',
  onLongPress,
  onSwipeRight,
  onSwipeLeft,
}: {
  enabled: boolean
  /** Onde o toque não inicia gesto. */
  ignore?: string
  onLongPress: () => void
  onSwipeRight: () => void
  onSwipeLeft: () => void
}) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopScrollWatch = useRef<(() => void) | null>(null)
  const fired = useRef(false)

  function clearHold() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  function reset() {
    clearHold()
    start.current = null
    stopScrollWatch.current?.()
    stopScrollWatch.current = null
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // Todo toque novo recomeça: um gesto anterior não engole o próximo clique.
    fired.current = false
    reset()
    if (!enabled || event.pointerType === 'mouse' || !event.isPrimary) return
    // O sheet de editar, o menu e as confirmações moram dentro da linha na
    // árvore do React, e o toque neles sobe até aqui pelo portal. Só conta o
    // toque que está na linha de fato, no DOM.
    const target = event.target as HTMLElement
    if (!event.currentTarget.contains(target) || target.closest(ignore)) return
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    timer.current = setTimeout(() => {
      timer.current = null
      fired.current = true
      onLongPress()
    }, HOLD_MS)
    const onScroll = () => reset()
    window.addEventListener('scroll', onScroll, { capture: true, passive: true, once: true })
    stopScrollWatch.current = () => window.removeEventListener('scroll', onScroll, { capture: true })
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const origin = start.current
    if (!origin || origin.id !== event.pointerId) return
    if (Math.abs(event.clientX - origin.x) > SLOP || Math.abs(event.clientY - origin.y) > SLOP) clearHold()
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const origin = start.current
    reset()
    if (!origin || origin.id !== event.pointerId || fired.current) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    fired.current = true
    if (dx > 0) onSwipeRight()
    else if (dx <= -88) onSwipeLeft()
  }

  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!fired.current) return
    fired.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset, onClickCapture }
}
