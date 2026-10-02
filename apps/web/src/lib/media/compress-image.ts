import type { CompressionResult } from './types'

const MAX_SIDE = 1920
const QUALITY = 0.86

// Canvas, e não uma biblioteca. O navegador já sabe redimensionar e
// codificar; trazer dependência para isso seria peso no pacote de uma tela
// que o dono abre do celular.
//
// `alwaysReencode`: o feedback anônimo SEMPRE recodifica, mesmo quando o
// resultado fica maior. A recodificação pelo canvas é o que apaga EXIF e GPS
// do arquivo; devolver o original vazaria onde a foto foi tirada.
export async function compressImage(
  file: File,
  options: { alwaysReencode?: boolean } = {},
): Promise<CompressionResult> {
  const bitmap = await createImageBitmap(file)

  try {
    // Sem AMPLIAR: `Math.min(1, ...)`. Esticar uma foto pequena para 1920
    // aumentaria o arquivo sem acrescentar um pixel de informação.
    const scale = Math.min(
      1,
      MAX_SIDE / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const original: CompressionResult = {
      blob: file,
      width: bitmap.width,
      height: bitmap.height,
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      if (options.alwaysReencode) throw new Error('Canvas 2D indisponível neste navegador.')
      return original
    }

    context.drawImage(bitmap, 0, 0, width, height)

    // WebP é o PEDIDO, não a promessa: Safari antigo aceita o pedido e
    // devolve PNG calado. Quem chama lê `blob.type` em vez de supor — é a
    // mesma regra que `captureVideoPoster` segue desde a Fase 2.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', QUALITY)
    })

    // Comprimir para PIORAR é o defeito clássico daqui. Acontece com PNG
    // pequeno e com foto que já veio otimizada.
    if (!blob) {
      if (options.alwaysReencode) throw new Error('O navegador não conseguiu codificar a imagem.')
      return original
    }
    if (!options.alwaysReencode && blob.size >= file.size) return original

    return { blob, width, height }
  } finally {
    // Sem isto, um dono que escolhe dez fotos segura dez bitmaps
    // descomprimidos na memória do celular.
    bitmap.close()
  }
}
