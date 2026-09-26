import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { getServerEnv } from '../../config/env.js'

export type EncryptedRefreshToken = {
  version: 1
  ciphertext: string
  nonce: string
  tag: string
}

function decodeCanonicalBase64(value: string): Buffer {
  const decoded = Buffer.from(value, 'base64')
  if (!value || decoded.toString('base64') !== value) throw new Error('Invalid encrypted device contract data.')
  return decoded
}

export function encryptDeviceRefreshToken(refreshToken: string): EncryptedRefreshToken {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getServerEnv().deviceContractEncryptionKey, nonce)
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()])

  return {
    version: 1,
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptDeviceRefreshToken(envelope: EncryptedRefreshToken): string {
  if (envelope.version !== 1) throw new Error('Unsupported device contract encryption version.')

  const ciphertext = decodeCanonicalBase64(envelope.ciphertext)
  const nonce = decodeCanonicalBase64(envelope.nonce)
  const tag = decodeCanonicalBase64(envelope.tag)
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid encrypted device contract data.')

  const decipher = createDecipheriv('aes-256-gcm', getServerEnv().deviceContractEncryptionKey, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
