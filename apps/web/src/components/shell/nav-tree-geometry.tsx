const TREE_STROKE = 2
const TREE_ICON_GAP = 4
const TREE_LIST_GAP = 4
const TREE_LIST_PAD_TOP = 8

export type NavTreeDensity = 'sidebar' | 'sheet'

export const RAIL = {
  sidebar: { gutter: 12, childPad: 36, radius: 8, row: 40 },
  sheet: { gutter: 12, childPad: 44, radius: 8, row: 48 },
} as const

export type Rail = (typeof RAIL)[NavTreeDensity]

function treeEndX(rail: Rail) {
  return rail.childPad - TREE_ICON_GAP
}

function treeChildY(index: number, rail: Rail) {
  return TREE_LIST_PAD_TOP + index * (rail.row + TREE_LIST_GAP) + rail.row / 2
}

function treeHeight(count: number, rail: Rail) {
  if (count <= 0) return 0
  return TREE_LIST_PAD_TOP + count * rail.row + (count - 1) * TREE_LIST_GAP
}

function treePath(count: number, rail: Rail) {
  if (count <= 0) return ''
  const x = rail.gutter
  const endX = treeEndX(rail)
  const last = count - 1
  const lastY = treeChildY(last, rail)
  const radius = Math.min(rail.radius, lastY, endX - x)
  let path = `M ${x} 0 L ${x} ${lastY - radius} Q ${x} ${lastY} ${x + radius} ${lastY} L ${endX} ${lastY}`

  for (let index = 0; index < last; index += 1) {
    const y = treeChildY(index, rail)
    const childRadius = Math.min(radius, y, endX - x)
    path += ` M ${x} ${y - childRadius} Q ${x} ${y} ${x + childRadius} ${y} L ${endX} ${y}`
  }

  return path
}

export function TreeRail({ count, rail }: { count: number; rail: Rail }) {
  if (count <= 0) return null

  return (
    <svg
      aria-hidden="true"
      width={treeEndX(rail) + TREE_STROKE}
      height={treeHeight(count, rail)}
      className="pointer-events-none absolute top-0 left-0 z-0 text-foreground opacity-40 dark:opacity-[0.38]"
    >
      <path
        d={treePath(count, rail)}
        fill="none"
        stroke="currentColor"
        strokeWidth={TREE_STROKE}
        strokeLinejoin="round"
        strokeLinecap="butt"
      />
    </svg>
  )
}
