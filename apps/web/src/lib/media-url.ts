import { MEDIA_LIMITS, type MediaKind } from '@/domain/media'

// Os buckets são públicos para leitura — o cardápio é público — então a URL
// é previsível e não precisa ser assinada a cada exibição.
//
// Lê process.env direto, e não @/server/env, porque este arquivo roda também
// no navegador e env.ts é server-only. O prefixo NEXT_PUBLIC_ é o que torna
// isso possível.
export function publicMediaUrl(kind: MediaKind, path: string): string {
  const bucket = MEDIA_LIMITS[kind].bucket
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}
