import 'server-only'
import { env } from '@/server/env'

export type Territory = 'site' | 'admin' | 'painel'

const ADMIN_PREFIX = 'admin.'
const WORKSPACE_PREFIX = 'painel.'

// Em desenvolvimento o Host chega como "admin.localhost:3000". Sem tirar a
// porta, nenhuma comparação bate e todo mundo cai no território público.
function stripPort(host: string): string {
  return host.split(':')[0].toLowerCase()
}

export function territoryFromHost(host: string | null): Territory {
  if (!host) return 'site'

  const root = stripPort(env.NEXT_PUBLIC_ROOT_DOMAIN)
  const current = stripPort(host)

  if (current === `${ADMIN_PREFIX}${root}`) return 'admin'
  if (current === `${WORKSPACE_PREFIX}${root}`) return 'painel'

  // Host desconhecido cai deliberadamente no território de MENOR
  // privilégio. Um header Host forjado nunca deve promover ninguém.
  return 'site'
}

// O protocolo é DERIVADO do domínio, e não lido de uma variável de ambiente.
// Em desenvolvimento o domínio é `localhost:3000`, que não tem TLS; em
// qualquer outro, tem. Uma variável a mais seria uma a mais para alguém
// esquecer de configurar — e o sintoma disso só apareceria em produção, num
// link que não abre.
export function defaultProtocol(): string {
  const semPorta = stripPort(env.NEXT_PUBLIC_ROOT_DOMAIN)
  return semPorta === 'localhost' || semPorta === '127.0.0.1'
    ? 'http:'
    : 'https:'
}

export function originFor(territory: Territory, protocol: string): string {
  const root = env.NEXT_PUBLIC_ROOT_DOMAIN
  if (territory === 'admin') return `${protocol}//${ADMIN_PREFIX}${root}`
  if (territory === 'painel') return `${protocol}//${WORKSPACE_PREFIX}${root}`
  return `${protocol}//${root}`
}

// Nome distinto por território. Os cookies já são host-only, então não
// colidiriam de qualquer forma; isto é seguro barato contra uma
// configuração futura de domínio pai fazer um território sombrear o outro.
export const cookieNameFor: Record<Territory, string> = {
  site: 'sb-site',
  admin: 'sb-admin',
  painel: 'sb-painel',
}
