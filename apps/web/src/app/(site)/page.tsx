import Link from 'next/link'
import { originFor, defaultProtocol } from '@/server/territory'

// Sem `title` aqui de propósito. O layout raiz declara
// `title: { default: 'Cardápio digital', template: '%s · Cardápio digital' }`,
// e repetir o mesmo texto nesta página faria o template se aplicar sobre ele:
// "Cardápio digital · Cardápio digital". Sem título próprio, o `default` vale.
export const metadata = {
  description: 'Cardápios de restaurante acessíveis por NFC e QR code.',
}

// Esta página é o que alguém vê ao digitar o domínio sem o endereço de um
// restaurante. Ela é pequena de propósito — não é site de marketing — mas
// deixou de ser HTML cru na Fase 4, porque é a primeira impressão do produto.
//
// Território público: nenhuma sessão, nenhum cookie, nenhum dado de
// restaurante. Só texto e um caminho para quem é dono.
export default function Page() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16 text-center font-sans">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-tv-hero/25 blur-3xl"
      />

      <div className="relative max-w-[440px]">
        <p className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Cardápio digital
        </p>
        <h1 className="mt-3 font-display text-display font-semibold leading-tight tracking-[-0.01em]">
          O cardápio está na mesa
        </h1>
        <p className="mt-4 text-body text-muted-foreground">
          Encoste o celular na plaquinha sobre sua mesa, ou aponte a câmera
          para o QR code. O cardápio abre sozinho — não precisa instalar nada.
        </p>

        <p className="mt-10 text-small text-muted-foreground">
          É dono de restaurante?{' '}
          {/* `originFor` é a mesma função que monta o link de convite. Usar
              ela aqui garante que os dois apontem para o mesmo lugar, em
              desenvolvimento e em produção. */}
          <Link
            href={originFor('painel', defaultProtocol())}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Entre no painel
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
