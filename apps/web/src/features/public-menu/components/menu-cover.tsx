import Image from 'next/image'
import { LuInstagram, LuMapPin, LuMessageCircle, LuPhone } from 'react-icons/lu'
import { publicMediaUrl } from '@/lib/media-url'
import { directionsUrl, displayAddress, type RestaurantContact } from '@/domain/restaurant'

type ContactLink = { label: string; href: string; icon: React.ReactNode }

// A coluna ZERO do feed, e não uma faixa antes dele. Assim o gesto tem um
// significado só no cardápio inteiro: horizontal é onde estou, vertical é o
// que tem nesta parada.
//
// A FOTO é uma faixa, não a tela toda. O primeiro desenho dava 100% da altura
// à capa, com a identidade espremida no rodapé — e capa de restaurante
// costuma ser uma textura genérica, que não merece a tela inteira. Quem
// importa aqui é o nome, o contato e o endereço.
export function MenuCover({
  name,
  description,
  logoPath,
  coverPath,
  contact,
}: {
  name: string
  description: string | null
  logoPath: string | null
  coverPath: string | null
  contact: RestaurantContact
}) {
  const addressText = displayAddress(contact)
  const directions = directionsUrl(contact)
  // O predicado é escrito à mão: a inferência automática de `filter` só
  // chegou no TypeScript 5.5, e o projeto declara `^5`, que permite 5.0.
  // Anotado como `(Atalho | null)[]` ANTES do filtro: sem isso o TypeScript
  // infere o tipo do literal — com `icone: Element` em vez de `ReactNode` —
  // e o predicado escrito à mão deixa de ser atribuível.
  //
  // A ordem e os rótulos são os da prévia do painel (README §7.8): Ligar,
  // WhatsApp, @instagram e Como chegar. O primeiro fica em destaque.
  const candidates: (ContactLink | null)[] = [
    contact.phone
      ? {
          label: 'Ligar',
          href: `tel:${contact.phone.replace(/\D/g, '')}`,
          icon: <LuPhone className="size-4 shrink-0" aria-hidden="true" />,
        }
      : null,
    contact.whatsapp
      ? {
          label: 'WhatsApp',
          href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`,
          icon: <LuMessageCircle className="size-4 shrink-0" aria-hidden="true" />,
        }
      : null,
    contact.instagram
      ? {
          label: `@${contact.instagram.replace(/^@+/, '')}`,
          href: `https://instagram.com/${contact.instagram.replace(/^@+/, '')}`,
          icon: <LuInstagram className="size-4 shrink-0" aria-hidden="true" />,
        }
      : null,
    directions
      ? {
          label: 'Como chegar',
          href: directions,
          icon: <LuMapPin className="size-4 shrink-0" aria-hidden="true" />,
        }
      : null,
  ]

  const links: ContactLink[] = candidates.filter(
    (link): link is ContactLink => link !== null,
  )

  return (
    <section className="menu-column" aria-label={`Sobre ${name}`}>
      <div className="menu-screens">
        <div className="menu-screen flex flex-col">
          {/* A faixa. `max-h` é o que impede ela de crescer sem limite numa
              tela alta, e `min-h` o que impede de virar um filete num
              aparelho baixo ou em paisagem. */}
          <div className="relative h-[34%] max-h-[300px] min-h-[140px] w-full shrink-0 overflow-hidden">
            {coverPath ? (
              <Image
                src={publicMediaUrl('image', coverPath)}
                alt=""
                fill
                sizes="100vw"
                priority
                className="object-cover"
              />
            ) : (
              // Sem capa, o tema desenha uma. Um retângulo cinza diria
              // "faltou foto"; isto diz "é assim".
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(150deg, color-mix(in oklab, var(--m-accent) 70%, var(--m-base)), var(--m-base))',
                }}
              />
            )}

            {/* A esfumaçada liga a faixa ao fundo do tema, em vez de cortar
                seco. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-24"
              style={{
                background:
                  'linear-gradient(to top, var(--m-base) 4%, transparent 100%)',
              }}
            />
          </div>

          {/* A identidade ocupa o resto da coluna, com o fundo do tema — o
              texto não fica mais sobre foto, então some também o risco de
              contraste imprevisível aqui. */}
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-[720px] px-5">
              {logoPath ? (
                // `-mt-14` sobe o logo sobre a faixa, e `relative z-10` é o
                // que o mantém NA FRENTE dela: elemento posicionado pinta
                // por cima de estático, e era esse o defeito do logo cortado.
                <div
                  className="menu-photo relative z-10 -mt-14 mb-5 size-20 overflow-hidden border-4"
                  style={{
                    borderColor: 'var(--m-base)',
                    background: 'var(--m-base)',
                  }}
                >
                  <Image
                    src={publicMediaUrl('image', logoPath)}
                    alt=""
                    fill
                    sizes="80px"
                    // Está na primeira tela. Sem isto o `next/image` usa
                    // `lazy`, e o navegador só busca o logo depois do layout,
                    // com prioridade baixa.
                    loading="eager"
                    className="p-1"
                    // No `style`, e não como classe: `menu.css` entra sem
                    // `@layer`, e no Tailwind v4 regra sem camada vence
                    // utilitário em `@layer utilities`. Medido.
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              ) : null}

              <h1 className="menu-display text-[2rem] font-semibold leading-tight">
                {name}
              </h1>

              {description ? (
                <p
                  className="mt-2 text-[0.9375rem] leading-relaxed"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {description}
                </p>
              ) : null}

              {links.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {links.map((link, index) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      // min-h-11 são os 44px de alvo de toque. Sobrando um
                      // atalho sozinho na última linha, ele ocupa as duas
                      // colunas. As cores vão no `style` pelo mesmo motivo do
                      // logo: `menu.css` fica fora de `@layer`.
                      className="menu-block flex min-h-11 min-w-0 items-center justify-center gap-2 px-3 text-sm font-medium [&:last-child:nth-child(odd)]:col-span-2"
                      style={
                        index === 0
                          ? { background: 'var(--m-accent)', color: 'var(--m-on-accent)' }
                          : { background: 'var(--m-chip)' }
                      }
                    >
                      {/* O ícone entra na Fase 5: só o rótulo fazia os três
                          atalhos virarem uma fileira de palavras iguais, e o
                          reconhecimento de marca é mais rápido que a leitura.

                          Todos abrem em `_blank`. Registrado: num `tel:` isso
                          não faz nada de útil — fica por consistência, a
                          pedido do dono do projeto. */}
                      {link.icon}
                      <span className="truncate">{link.label}</span>
                    </a>
                  ))}
                </div>
              ) : null}

              {addressText ? (
                <p
                  className="mt-4 text-[0.8125rem] leading-relaxed"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {addressText}
                </p>
              ) : null}
            </div>
          </div>

          {/* A dica fica ancorada no rodapé da coluna, e não colada no
              endereço: ela é sobre o GESTO, não sobre o restaurante. Existe
              porque o eixo horizontal não é o que a pessoa espera ao abrir
              uma página, e aparece só na capa. */}
          <div className="mx-auto w-full max-w-[720px] shrink-0 px-5 pb-10">
            <p
              className="text-[0.75rem] font-medium uppercase tracking-[0.14em]"
              style={{ color: 'var(--m-muted)' }}
            >
              Deslize para ver o cardápio →
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
