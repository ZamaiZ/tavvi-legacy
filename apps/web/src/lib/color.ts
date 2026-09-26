// Conversões de cor, sem dependência externa. A matemática é a de sempre —
// sRGB → linear → LMS → Oklab → OKLCH — com os coeficientes publicados por
// Björn Ottosson.
//
// Este arquivo roda no servidor E no navegador: o servidor valida a escolha
// do dono antes de gravar, e o seletor de cor pré-visualiza enquanto ele
// escolhe. Por isso não pode importar NADA de `@/server`. Não é pureza de
// estilo: é o que permite a pré-visualização ao vivo existir.

export type Oklch = { l: number; c: number; h: number }

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

// Devolve os três canais JÁ linearizados, que é o que tanto o Oklab quanto a
// luminância do WCAG precisam. Converter em dois lugares seria desperdício e,
// pior, uma chance de as duas contas divergirem com o tempo.
function hexToLinearRgb(hex: string): [number, number, number] {
  if (!isHex(hex)) throw new Error(`Cor inválida: ${String(hex)}`)
  const n = Number.parseInt(hex.slice(1), 16)
  return [
    toLinear(((n >> 16) & 255) / 255),
    toLinear(((n >> 8) & 255) / 255),
    toLinear((n & 255) / 255),
  ]
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToLinearRgb(hex)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return {
    l: okL,
    c: Math.hypot(okA, okB),
    h: ((Math.atan2(okB, okA) * 180) / Math.PI + 360) % 360,
  }
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearRgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Razão de contraste do WCAG 2.1. Vai de 1 (idênticas) a 21 (preto sobre
// branco). Texto de corpo pede 4,5; texto grande e elemento de interface,
// 3. A ordem dos argumentos não importa.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// Escolhe, entre candidatas, a que mais contrasta com o fundo. É assim que o
// texto deixa de ser escolha do dono: ele move o fundo, e o texto vai atrás
// sozinho, sempre para o lado legível. Não existe combinação em que ele
// acerte o fundo e erre o texto, porque o texto não é escolha dele.
export function pickByContrast(
  background: string,
  candidates: readonly string[],
): string {
  if (candidates.length === 0) throw new Error('Sem candidatas')

  let best = candidates[0]
  let bestRatio = contrastRatio(background, best)

  for (const candidate of candidates.slice(1)) {
    const ratio = contrastRatio(background, candidate)
    if (ratio > bestRatio) {
      best = candidate
      bestRatio = ratio
    }
  }

  return best
}

// A volta do caminho que `hexToOklch` faz na ida: OKLCH → Oklab → LMS →
// linear → sRGB. Os coeficientes são a inversa dos da ida, publicados pelo
// mesmo Björn Ottosson.
//
// O grampeamento em 0–255 é a parte que importa para o resto do sistema: um
// OKLCH pode descrever cor fora do gamute do sRGB, e o que a tela mostra é o
// valor grampeado. Como o contraste é sempre medido sobre o hex que sai
// daqui, a conta nunca mente sobre o que o cliente vai ver.
function fromLinear(channel: number): number {
  const v =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)

  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b

  const lLms = lRoot ** 3
  const mLms = mRoot ** 3
  const sLms = sRoot ** 3

  const r = 4.0767416621 * lLms - 3.3077115913 * mLms + 0.2309699292 * sLms
  const g = -1.2684380046 * lLms + 2.6097574011 * mLms - 0.3413193965 * sLms
  const bl = -0.0041960863 * lLms - 0.7034186147 * mLms + 1.707614701 * sLms

  return `#${[r, g, bl]
    .map((channel) => fromLinear(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

// Move a LUMINOSIDADE da cor até ela atingir o piso contra o fundo,
// preservando croma e matiz. É isto que permite o destaque do dono existir
// nas duas faces do tema sem virar outra cor: o olho reconhece uma marca
// pelo matiz e pela saturação, não pela luminosidade.
//
// A busca é binária entre a luminosidade atual, que reprova, e o extremo — 1
// ou 0. Ela converge para o ponto MAIS PRÓXIMO do original que passa, ou
// seja, o menor desvio possível da cor escolhida, e não um preto ou branco.
//
// Devolve null quando nem o extremo atinge o piso. Acontece com croma alto
// sobre fundo de luminosidade parecida, e o certo aí é recusar a escolha, e
// não entregar uma cor que o cliente não enxerga.
export function fitContrast(
  color: string,
  background: string,
  minRatio: number,
): string | null {
  if (!isHex(color) || !isHex(background)) return null
  if (contrastRatio(background, color) >= minRatio) return color

  const { l, c, h } = hexToOklch(color)

  // O fundo decide qual direção tem chance: sobre fundo escuro, clarear;
  // sobre claro, escurecer. A outra direção é tentada depois, porque croma
  // alto pode fechar a primeira antes de ela chegar ao piso.
  const endpoints = hexToOklch(background).l < 0.5 ? [1, 0] : [0, 1]

  for (const endpoint of endpoints) {
    if (contrastRatio(background, oklchToHex({ l: endpoint, c, h })) < minRatio) {
      continue
    }

    // `perto` reprova, `longe` aprova. A cada passo o intervalo encolhe na
    // direção de `perto`, então o resultado é o mínimo movimento que serve.
    let failingLightness = l
    let passingLightness = endpoint
    let bestColor = oklchToHex({ l: endpoint, c, h })

    for (let step = 0; step < 24; step += 1) {
      const midpoint = (failingLightness + passingLightness) / 2
      const candidate = oklchToHex({ l: midpoint, c, h })
      if (contrastRatio(background, candidate) >= minRatio) {
        bestColor = candidate
        passingLightness = midpoint
      } else {
        failingLightness = midpoint
      }
    }
    return bestColor
  }

  return null
}
