export type NotchedPathOptions = {
  width: number
  height: number
  radius: number
  notchW: number
  notchH: number
  curve: number
}

export function createNotchedPath({
  width,
  height,
  radius,
  notchW,
  notchH,
  curve,
}: NotchedPathOptions) {
  const notchX = width - notchW
  const control = curve * 0.45

  return [
    `M ${radius} 0`,
    `H ${notchX - curve}`,
    `C ${notchX - control} 0 ${notchX} ${control} ${notchX} ${curve}`,
    `V ${notchH - curve}`,
    `C ${notchX} ${notchH - control} ${notchX + control} ${notchH} ${notchX + curve} ${notchH}`,
    `H ${width - radius}`,
    `C ${width - 12} ${notchH} ${width} ${notchH + 12} ${width} ${notchH + radius}`,
    `V ${height - radius}`,
    `C ${width} ${height - 12} ${width - 12} ${height} ${width - radius} ${height}`,
    `H ${radius}`,
    `C 12 ${height} 0 ${height - 12} 0 ${height - radius}`,
    `V ${radius}`,
    `C 0 12 12 0 ${radius} 0`,
    'Z',
  ].join(' ')
}
