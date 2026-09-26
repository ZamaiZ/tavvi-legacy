import 'server-only'
import { headers } from 'next/headers'

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const IPV6 = /^[0-9a-f:]+$/i

// ATENCAO, item obrigatorio da checagem de publicacao: x-forwarded-for e
// falsificavel quando nao vem de um proxy confiavel. Em desenvolvimento
// isso e irrelevante. Ao hospedar, trocar pelo header que a plataforma
// garante (na Vercel, x-vercel-forwarded-for).
export async function clientIp(): Promise<string | null> {
  const requestHeaders = await headers()
  const candidate =
    requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() ??
    requestHeaders.get('x-real-ip')?.trim() ??
    null

  if (!candidate) return null
  if (IPV4.test(candidate) || IPV6.test(candidate)) return candidate
  // Nao e endereco valido: devolve nulo em vez de propagar lixo para uma
  // coluna inet, que recusaria o insert e derrubaria a operacao inteira.
  return null
}

// Identificador para rate limit de visitante anonimo. Quando o IP nao vem,
// todos caem no mesmo balde -- o que APERTA o limite, e nunca o afrouxa.
export async function rateLimitIdentity(): Promise<string> {
  return (await clientIp()) ?? 'ip-ausente'
}
