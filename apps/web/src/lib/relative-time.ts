const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "agora", "há 5 min", "há 2 h", "ontem", "12/09". Depende do relógio e do
// fuso de quem vê: quem renderiza no servidor deve usar
// suppressHydrationWarning no elemento.
export function relativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Math.max(0, now - time)
  if (diff < MINUTE) return 'agora'
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (new Date(time).toDateString() === yesterday.toDateString()) return 'ontem'
  return new Date(time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// "01/10/2026 21:16"
export function fullDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date
    .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .replace(',', '')
}
