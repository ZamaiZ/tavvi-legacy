import type { TagDTO } from '@/domain/tag'

export function tagName(tag: TagDTO) { return tag.tableNumber ? `Mesa ${tag.tableNumber}` : 'Mesa não definida' }

export function lastSeen(tag: TagDTO) {
  if (!tag.lastSeenAt) return 'Ainda não acessado'
  const date = new Date(tag.lastSeenAt)
  if (Number.isNaN(date.getTime())) return 'Ainda não acessado'
  return `Acessado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)}`
}

export function tagPublicUrl(tag: TagDTO) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? window.location.host.replace(/^painel\./, '')
  const protocol = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rootDomain) ? 'http:' : 'https:'
  return `${protocol}//${rootDomain}/t/${tag.publicToken}`
}
