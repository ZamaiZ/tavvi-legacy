const mediumDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
export function formatDate(value: string | number | Date) { return mediumDate.format(new Date(value)) }

// "há 5 min", "ontem"... à mão: o Hermes não garante Intl.RelativeTimeFormat.
export function formatRelative(value: string | number | Date, now = Date.now()) {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return formatDate(value)
}
