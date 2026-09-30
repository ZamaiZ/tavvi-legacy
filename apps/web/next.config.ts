import type { NextConfig } from 'next'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
const IS_PROD = process.env.NODE_ENV === 'production'

// O host do storage sai da propria variavel de ambiente: em desenvolvimento
// o Supabase pode ser local e na nuvem e https://<projeto>.supabase.co.
// Escrever o host a mao quebraria um dos dois.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null

// Em desenvolvimento o Next precisa de 'unsafe-eval' para o refresh rapido.
// Em producao ele sai. CSP estrita com nonce fica para a Fase 3, quando
// existir HTML publico de verdade para proteger.
const scriptSrc = IS_PROD
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "connect-src 'self' https: ws:",
].join('; ')

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // A porta precisa aparecer por extenso: 'localhost' NAO casa com
      // 'localhost:3000'. Sem estas tres entradas, as server actions
      // falham em admin. e painel. com um erro pouco descritivo.
      allowedOrigins: [ROOT, `admin.${ROOT}`, `painel.${ROOT}`],
    },
  },
  // O servidor de desenvolvimento tambem precisa aceitar os subdominios,
  // senao os assets de /_next nao chegam em admin.localhost:3000.
  // O tunel do ngrok entra aqui pelo mesmo motivo.
  allowedDevOrigins: [`admin.${ROOT}`, `painel.${ROOT}`, '*.ngrok-free.dev'],

  // O feed desenha foto em tela cheia. Servir o arquivo original, no tamanho
  // em que o dono enviou, e o maior desperdicio de banda do app -- e a rede
  // de uma mesa de restaurante e justamente a pior que existe.
  //
  // A CSP NAO muda: o otimizador serve por /_next/image, que ja esta coberto
  // por `img-src 'self'` na politica montada acima.
  images: {
    remotePatterns: SUPABASE
      ? [
          {
            protocol: SUPABASE.protocol.replace(':', '') as 'http' | 'https',
            hostname: SUPABASE.hostname,
            port: SUPABASE.port || undefined,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ]
  },
}

export default nextConfig
