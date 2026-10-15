import type { ServiceCallDTO } from '@/domain/service-call'

const formatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function formatCallTime(value: string): string {
  return formatter.format(new Date(value))
}

export function formatElapsed(start: string, end: string | number = Date.now()): string {
  const endMs = typeof end === 'number' ? end : Date.parse(end)
  const seconds = Math.max(0, Math.floor((endMs - Date.parse(start)) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`
  if (minutes > 0) return `${minutes} min ${String(remainder).padStart(2, '0')} s`
  return `${remainder} s`
}

export function callWaitDuration(call: ServiceCallDTO): string | null {
  if (!call.firstClaimedAt) return null
  return formatElapsed(call.createdAt, call.firstClaimedAt)
}

export function callServiceDuration(call: ServiceCallDTO, now: number = Date.now()): string | null {
  if (!call.firstClaimedAt) return null
  const end = call.resolvedAt ?? now
  return formatElapsed(call.firstClaimedAt, end)
}
