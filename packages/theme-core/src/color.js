const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export function normalizeHex(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return null
  return value.toUpperCase()
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  return [1, 3, 5].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
}

export function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function toOklch(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const l = Math.cbrt(0.4122214708 * linear[0] + 0.5363325363 * linear[1] + 0.0514459929 * linear[2])
  const m = Math.cbrt(0.2119034982 * linear[0] + 0.6806995451 * linear[1] + 0.1073969566 * linear[2])
  const s = Math.cbrt(0.0883024619 * linear[0] + 0.2817188376 * linear[1] + 0.6299787005 * linear[2])
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) }
}

export function fromOklch({ L, C, h }) {
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return rgbToHex(linear.map((value) => {
    const channel = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
    return clamp(channel)
  }))
}

export function mixHex(foreground, background, amount) {
  const a = hexToRgb(foreground)
  const b = hexToRgb(background)
  if (!a || !b) return foreground
  return rgbToHex(a.map((channel, index) => channel * amount + b[index] * (1 - amount)))
}

export function rgba(hex, alpha) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'rgba(37, 99, 235, 0.12)'
  return `rgba(${rgb.map((value) => Math.round(value * 255)).join(', ')}, ${alpha})`
}

export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
