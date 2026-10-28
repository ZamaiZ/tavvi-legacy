export function formatRestaurantDateTime(value: string, timeZone: string, options: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium', timeStyle: 'short',
}): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { ...options, timeZone }).format(new Date(value))
  } catch {
    return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value))
  }
}

function wallClockParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function toRestaurantDateTimeInput(value: string | null, timeZone: string): string {
  if (!value) return ''
  try {
    const parts = wallClockParts(new Date(value), timeZone)
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  } catch {
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  }
}

export function fromRestaurantDateTimeInput(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  const targetWallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  let candidate = targetWallTime
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const parts = wallClockParts(new Date(candidate), timeZone)
      const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
      const difference = targetWallTime - representedWallTime
      if (!difference) break
      candidate += difference
    }
    const verified = wallClockParts(new Date(candidate), timeZone)
    if (Number(verified.year) !== Number(year) || Number(verified.month) !== Number(month)
      || Number(verified.day) !== Number(day) || Number(verified.hour) !== Number(hour)
      || Number(verified.minute) !== Number(minute)) return null
    return new Date(candidate).toISOString()
  } catch {
    return null
  }
}
