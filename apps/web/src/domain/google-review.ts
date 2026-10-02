import { z } from 'zod'

// O Place ID "ChIJ…" é um protobuf em base64url com o par de números que o
// Google Maps mostra nos links como `0x<alto>:0x<baixo>`:
//   0a 12 | 09 <alto, uint64 little-endian> | 11 <baixo, uint64 little-endian>
// Verificado com um perfil real: 0x94cef526d821badb:0xda98d638351e21cd →
// ChIJ27oh2Cb1zpQRzSEeNTjWmNo. Não é contrato público do Google: se mudar,
// a resolução deixa de achar o par e o botão some, sem quebrar o cardápio.

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/
const FEATURE_ID = /0x([0-9a-f]{1,16}):0x([0-9a-f]{1,16})/i
const WRITE_REVIEW = 'https://search.google.com/local/writereview?placeid='
const G_PAGE_REVIEW = /^https:\/\/g\.page\/r\/[A-Za-z0-9_-]+\/review$/

export type GoogleReviewStatus = 'active' | 'none' | 'not_business' | 'unavailable'
export type GoogleReviewOutcome = { googleReview: GoogleReviewStatus; googleReviewUrl: string | null }

export function writeReviewUrl(placeId: string): string {
  return `${WRITE_REVIEW}${placeId}`
}

export function isGoogleReviewUrl(value: string): boolean {
  if (G_PAGE_REVIEW.test(value)) return true
  return value.startsWith(WRITE_REVIEW) && PLACE_ID.test(value.slice(WRITE_REVIEW.length))
}

export const googleReviewUrlSchema = z.string().max(400).refine(isGoogleReviewUrl)

// BigInt por chamada, e não por literal (`0xffn`): o tsconfig mira ES2017.
function uint64LittleEndian(hex: string): number[] {
  let value = BigInt(`0x${hex}`)
  const mask = BigInt(255)
  const eight = BigInt(8)
  const bytes: number[] = []
  for (let index = 0; index < 8; index += 1) {
    bytes.push(Number(value & mask))
    value = value >> eight
  }
  return bytes
}

export function placeIdFromFeatureId(high: string, low: string): string {
  const bytes = [0x0a, 0x12, 0x09, ...uint64LittleEndian(high), 0x11, ...uint64LittleEndian(low)]
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Procura um destino de avaliação só no TEXTO do link, sem rede: o próprio
// link de avaliação, um Place ID num parâmetro, ou o par 0x…:0x….
export function reviewUrlFromLink(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const path = `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  if (G_PAGE_REVIEW.test(path)) return path

  for (const key of ['placeid', 'place_id', 'query_place_id']) {
    const candidate = url.searchParams.get(key)
    if (candidate && PLACE_ID.test(candidate)) return writeReviewUrl(candidate)
  }
  const query = url.searchParams.get('q')
  if (query?.startsWith('place_id:')) {
    const candidate = query.slice('place_id:'.length)
    if (PLACE_ID.test(candidate)) return writeReviewUrl(candidate)
  }

  const feature = FEATURE_ID.exec(safeDecode(url.toString()))
  return feature ? writeReviewUrl(placeIdFromFeatureId(feature[1], feature[2])) : null
}
