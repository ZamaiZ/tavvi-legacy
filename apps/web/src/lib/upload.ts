// Utilitário de NAVEGADOR. Não importa nada de @/server e não conhece
// Supabase: a URL assinada carrega a própria autorização, então um fetch
// basta. É isso que mantém @supabase/* fora do pacote do navegador.

// Aceita Blob, não File: a capa do vídeo é gerada por canvas e sai como
// Blob puro, sem nome nem tipo próprio. Por isso o mimeType vem separado.
export async function uploadToSignedUrl(
  signedUrl: string,
  body: Blob,
  mimeType: string,
): Promise<void> {
  // Corpo CRU, com content-type. Mandar o próprio Blob faria o Supabase
  // esperar um FormData de formato interno; o caminho de corpo cru é o
  // contrato estável.
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': mimeType,
      'cache-control': 'max-age=3600',
    },
    body: await body.arrayBuffer(),
  })

  if (!response.ok) {
    throw new Error('Falha ao enviar o arquivo.')
  }
}

// Espera um evento do elemento, com teto de tempo. Sem o teto, um códec que
// o navegador aceita carregar mas não consegue decodificar deixaria a
// promessa pendurada para sempre, e a interface travada.
function waitFor(
  element: HTMLVideoElement,
  event: 'loadedmetadata' | 'seeked',
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const limit = setTimeout(() => {
      cleanup()
      reject(new Error(`tempo esgotado esperando ${event}`))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(limit)
      element.removeEventListener(event, onDone)
      element.removeEventListener('error', onFail)
    }
    function onDone() {
      cleanup()
      resolve()
    }
    function onFail() {
      cleanup()
      reject(new Error('falha ao decodificar o vídeo'))
    }

    element.addEventListener(event, onDone)
    element.addEventListener('error', onFail)
  })
}

export async function readVideoDurationMs(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = url

  try {
    await waitFor(video, 'loadedmetadata')
    return Number.isFinite(video.duration)
      ? Math.round(video.duration * 1000)
      : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Devolve null em vez de lançar. Falhar em capturar uma capa não pode
// impedir alguém de subir o vídeo do próprio prato -- decisão C5.
export async function captureVideoPoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url

  try {
    await waitFor(video, 'loadedmetadata')

    // 0,1s em vez de 0: o quadro exato em zero costuma vir preto.
    video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
    await waitFor(video, 'seeked')

    if (!video.videoWidth || !video.videoHeight) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // WebP é o PEDIDO, não a promessa. Safari antigo aceita o pedido e
    // devolve PNG calado, por isso quem chama precisa ler blob.type em vez
    // de supor o formato.
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85)
    })
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
