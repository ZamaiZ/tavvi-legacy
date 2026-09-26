const LONG_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function dateFrom(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function formatLong(value: string | Date) {
  return LONG_DATE.format(dateFrom(value))
}

export function formatShort(value: string | Date) {
  return SHORT_DATE.format(dateFrom(value))
}
