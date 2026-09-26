'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { MenuMediaDTO } from '@/domain/menu'
import { publicMediaUrl } from '@/lib/media-url'

// Quanto a proporção da foto pode divergir da da tela antes de ela deixar de
// "caber no formato". 1.25 significa que o recorte do `cover` tiraria no
// máximo cerca de um quinto da imagem.
//
// Nos números reais: num celular de 375×812 a caixa é 0,46. Uma foto 9:16
// (0,56) divide em 1,22 e vai a sangria; uma foto 4:5 (0,80) divide em 1,73 e
// é emoldurada. Ou seja, só foto de fato vertical ocupa a tela inteira.
const TOLERANCIA_DE_ENCAIXE = 1.25

function cabeNoFormato(
  larguraImagem: number,
  alturaImagem: number,
  larguraCaixa: number,
  alturaCaixa: number,
): boolean {
  if (!larguraImagem || !alturaImagem || !larguraCaixa || !alturaCaixa) {
    return false
  }
  const daImagem = larguraImagem / alturaImagem
  const daCaixa = larguraCaixa / alturaCaixa
  const divergencia =
    Math.max(daImagem, daCaixa) / Math.min(daImagem, daCaixa)
  return divergencia <= TOLERANCIA_DE_ENCAIXE
}

// Uma tela do feed. Sempre 100dvh — o que muda é COMO a mídia ocupa ela.
//
// Vídeo vai sempre a sangria: ele é gravado para ser visto assim, e é o que
// o dono filmou de propósito. Imagem vai a sangria só quando CABE NO
// FORMATO; quando não cabe, é emoldurada sobre o fundo do tema, com uma
// cópia desfocada atrás. Estourar uma foto quadrada para tela cheia é
// recortar o prato fora do quadro — o mesmo defeito do logo, em escala.
export function MenuMedia({
  media,
  priority,
  active,
  isNearViewport,
}: {
  media: MenuMediaDTO
  /** Primeira tela do primeiro prato: carrega sem esperar. */
  priority: boolean
  /** A tela está visível agora. Só ela toca vídeo. */
  active: boolean
  /** A tela está no raio de pré-carga. Fora dele, nada é buscado. */
  isNearViewport: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Quando o banco SABE as dimensões, a decisão de sangria ou moldura é
  // tomada antes de a imagem carregar, e não há troca de enquadramento no
  // meio — era a limitação que a Fase 4 aceitou e a Fase 5 fechou, ao passar
  // a gravar `width` e `height` na compressão.
  //
  // Linhas antigas continuam nulas e caem no `onLoad`, que por isso não sai
  // daqui: ele é a reserva, não o caminho principal.
  //
  // Inicializador preguiçoso porque toca `window`: num componente de cliente
  // ele só roda no navegador, mas a forma deixa isso explícito.
  const [isFramed, setIsFramed] = useState<boolean | null>(() =>
    media.width && media.height
      ? cabeNoFormato(
          media.width,
          media.height,
          window.innerWidth,
          window.innerHeight,
        )
      : null,
  )
  const position = `${media.focalX * 100}% ${media.focalY * 100}%`

  // Rede apertada e menos movimento desligam o autoplay. O navegador nem
  // sempre expõe `connection`, então o encadeamento opcional é a forma
  // correta de ler — e `typeof` protege o render do servidor.
  const conexao =
    typeof navigator !== 'undefined'
      ? (
          navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string }
          }
        ).connection
      : undefined

  const isLimitedNetwork =
    conexao?.saveData === true ||
    conexao?.effectiveType === 'slow-2g' ||
    conexao?.effectiveType === '2g'

  const reduzido =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const autoplay = active && !isLimitedNetwork && !reduzido

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (autoplay) {
      // `catch` porque o navegador recusa `play()` em várias situações
      // legítimas — aba em segundo plano, economia de bateria. Recusa de
      // autoplay não é erro que o cliente precise ver.
      void el.play().catch(() => {})
    } else {
      el.pause()
      el.currentTime = 0
    }
  }, [autoplay])

  if (media.kind === 'video') {
    return (
      <div className="menu-screen">
        <video
          ref={videoRef}
          src={publicMediaUrl('video', media.storagePath)}
          poster={
            media.posterPath
              ? publicMediaUrl('image', media.posterPath)
              : undefined
          }
          // SEM SOM, sempre. Som saindo do celular de alguém numa mesa de
          // restaurante é agressão, e é a mesma razão pela qual o vídeo tem
          // teto de 15 segundos desde a Fase 2.
          muted
          playsInline
          loop
          // Quem não recebe autoplay ainda pode assistir se quiser.
          controls={!autoplay}
          preload={isNearViewport && !isLimitedNetwork ? 'metadata' : 'none'}
          className="h-full w-full object-cover"
          style={{ objectPosition: position }}
        />
      </div>
    )
  }

  // Fora do raio de vizinhança a foto não é buscada. Quarenta pratos seriam
  // quarenta imagens de tela cheia numa rede de restaurante.
  //
  // O espaço reservado é do TEMA, e não um cinza: cinza diria "quebrou";
  // isto diz "está vindo".
  if (!isNearViewport && !priority) {
    return (
      <div
        className="menu-screen"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(160deg, color-mix(in oklab, var(--m-accent) 22%, var(--m-base)), var(--m-base))',
        }}
      />
    )
  }

  const src = publicMediaUrl('image', media.storagePath)
  const sangria = isFramed === true

  return (
    <div className="menu-screen overflow-hidden">
      {/* A cópia desfocada preenche a moldura sem inventar cor. Só existe
          quando a foto NÃO cabe — a sangria cobre a tela sozinha. */}
      {!sangria ? (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="scale-110 object-cover blur-2xl"
          style={{ opacity: 0.35 }}
        />
      ) : null}

      <Image
        src={src}
        alt={media.altText ?? ''}
        fill
        // O feed é uma coluna por tela em qualquer aparelho, então a imagem
        // sempre ocupa a largura inteira da janela.
        sizes="100vw"
        priority={priority}
        className={sangria ? 'object-cover' : 'object-contain'}
        // `objectPosition` só faz diferença no recorte. Emoldurada, a foto
        // aparece inteira e centrar é o certo.
        style={sangria ? { objectPosition: position } : undefined}
        onLoad={(event) => {
          const img = event.currentTarget
          const caixa = img.parentElement
          setIsFramed(
            cabeNoFormato(
              img.naturalWidth,
              img.naturalHeight,
              caixa?.clientWidth ?? 0,
              caixa?.clientHeight ?? 0,
            ),
          )
        }}
      />
    </div>
  )
}
