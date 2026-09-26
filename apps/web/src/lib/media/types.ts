// Tipos do pipeline de mídia. Arquivo de NAVEGADOR: não importa nada de
// `@/server` e não conhece Supabase.

// `comprimiu: false` significa que o ORIGINAL está voltando, e não que algo
// falhou. Acontece quando a compressão sairia maior — PNG pequeno, foto já
// otimizada — e comprimir para piorar é o defeito clássico deste tipo de
// código.
export type CompressionResult = {
  blob: Blob
  width: number
  height: number
}

export type MediaStatus = 'pending' | 'compressing' | 'uploading' | 'error' | 'ready'

// Uma mídia escolhida e ainda NÃO gravada. Ela vive no navegador até o dono
// confirmar. `idLocal` é do navegador, não do banco: a linha do banco só
// existe depois do envio.
export type PendingMedia = {
  localId: string
  file: File
  previewUrl: string
  kind: 'image' | 'video'
  status: MediaStatus
  progress: number
  error?: string
}
