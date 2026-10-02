'use client'

import {
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DropAnimation,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

// Mouse: o arrasto só começa depois de 6 px, então clique, select e botões
// continuam funcionando. Toque: segurar 250 ms, para rolar a página não
// virar arrasto. Teclado: espaço pega e solta; Enter fica para os botões.
export function usePanelSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
}

export const PANEL_DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable: 'Para mover, pressione espaço. Use as setas para escolher o lugar e espaço de novo para soltar. Esc cancela.',
}

export function panelAnnouncements(
  describe: (id: UniqueIdentifier) => string,
  place: (id: UniqueIdentifier) => string,
): Announcements {
  return {
    onDragStart: ({ active }) => `${describe(active.id)} selecionado para mover.`,
    onDragOver: ({ active, over }) => (over ? `${describe(active.id)} sobre ${place(over.id)}.` : `${describe(active.id)} fora de uma área de soltar.`),
    onDragEnd: ({ active, over }) => (over ? `${describe(active.id)} solto em ${place(over.id)}.` : `${describe(active.id)} solto fora de uma área; nada mudou.`),
    onDragCancel: ({ active }) => `Movimento de ${describe(active.id)} cancelado.`,
  }
}

// Soltar: a peça desce da inclinação para 0° junto com o encaixe. A classe
// `is-dropping` vai no invólucro do overlay; o CSS faz a transição do
// `rotate` da peça (`.tv-lift`) de volta a zero nos mesmos 180 ms.
export const LIFT_DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: 'cubic-bezier(.2,.8,.2,1)',
  sideEffects: defaultDropAnimationSideEffects({
    className: { dragOverlay: 'is-dropping' },
    styles: { active: { opacity: '0' } },
  }),
}
