import 'server-only'
import { createHash, randomBytes, randomInt } from 'node:crypto'

// 32 bytes = 256 bits. Em base64url sao 43 caracteres, sem preenchimento.
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

// O banco guarda SO isto. Vazar o banco nao entrega acesso a ninguem,
// porque o hash nao volta a ser token.
export function hashInviteToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

// O formato que o Postgres espera para bytea numa chamada do PostgREST.
export function hashInviteTokenForDb(token: string): string {
  return `\\x${hashInviteToken(token).toString('hex')}`
}

// Base32 sem I, L, O e U: sao os caracteres que se confundem com 1, 1, 0 e
// V ao ditar por telefone ou reimprimir um identificador gasto.
const TAG_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function generateTagToken(): string {
  let token = ''
  for (let i = 0; i < 16; i += 1) {
    token += TAG_ALPHABET[randomInt(TAG_ALPHABET.length)]
  }
  return token
}
