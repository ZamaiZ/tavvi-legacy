import { directionsUrl, displayAddress, type RestaurantContact } from '@/domain/restaurant'
import { publicMediaUrl } from '@/lib/media-url'
import Image from 'next/image'
import { FaWhatsapp } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import {
  LuBookOpen,
  LuChevronRight,
  LuInstagram,
  LuMapPin,
  LuMessageSquareText,
  LuPhone
} from 'react-icons/lu'

type ContactLink = { label: string; href: string; icon: React.ReactNode }

// A coluna ZERO do feed: a tela inicial. Capa, identidade, os contatos em
// ícones e a lista do que dá para fazer aqui (Avaliar no Google, Ver
// cardápio, Feedback anônimo), no desenho do Candour. Deslizar para o lado
// continua levando aos pratos.
//
// A FOTO é uma faixa, não a tela toda: capa de restaurante costuma ser uma
// textura genérica. A altura usa dvh, e não %, porque a tela agora cresce
// com o conteúdo (rola na vertical em aparelho baixo) e % de um pai com
// altura automática não vale nada.
export function MenuCover({
  name,
  description,
  logoPath,
  coverPath,
  contact,
  googleReviewUrl,
  hasDishes,
  onViewMenu,
  onOpenFeedback,
}: {
  name: string
  description: string | null
  logoPath: string | null
  coverPath: string | null
  contact: RestaurantContact
  /** Só com link de avaliação gerado a partir do Maps salvo. */
  googleReviewUrl: string | null
  hasDishes: boolean
  onViewMenu: () => void
  onOpenFeedback: () => void
}) {
  const addressText = displayAddress(contact)
  const directions = directionsUrl(contact)
  const handle = contact.instagram?.replace(/^@+/, '') ?? ''
  // Anotado ANTES do filtro pelo mesmo motivo de sempre: sem isso o TS
  // infere `icon: Element` e o predicado escrito à mão deixa de servir.
  const candidates: (ContactLink | null)[] = [
    contact.phone
      ? { label: 'Ligar', href: `tel:${contact.phone.replace(/\D/g, '')}`, icon: <LuPhone aria-hidden="true" /> }
      : null,
    contact.whatsapp
      ? { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`, icon: <FaWhatsapp aria-hidden="true" /> }
      : null,
    handle
      ? { label: `Instagram @${handle}`, href: `https://instagram.com/${handle}`, icon: <LuInstagram aria-hidden="true" /> }
      : null,
    directions ? { label: 'Como chegar', href: directions, icon: <LuMapPin aria-hidden="true" /> } : null,
  ]
  const links: ContactLink[] = candidates.filter((link): link is ContactLink => link !== null)

  return (
    <section className="menu-column" aria-label={`Sobre ${name}`}>
      <div className="menu-screens">
        <div className="menu-screen is-cover flex flex-col">
          <div className="relative h-[34dvh] max-h-[300px] min-h-[140px] w-full shrink-0 overflow-hidden">
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
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-24"
              style={{ background: 'linear-gradient(to top, var(--m-base) 4%, transparent 100%)' }}
            />
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-[720px] px-5 pb-6">
              {logoPath ? (
                // `relative z-10` mantém o logo NA FRENTE da faixa.
                <div
                  className="menu-photo relative z-10 -mt-14 mb-5 size-20 overflow-hidden border-4"
                  style={{ borderColor: 'var(--m-base)', background: 'var(--m-base)', borderRadius: '50%' }}
                >
                  <Image
                    src={publicMediaUrl('image', logoPath)}
                    alt=""
                    fill
                    sizes="80px"
                    loading="eager"
                    className="p-1"
                    // No `style`: `menu.css` entra sem `@layer` e venceria o utilitário.
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              ) : null}

              <h1 className="menu-display text-[2rem] font-semibold leading-tight">{name}</h1>

              {description ? (
                <p className="mt-2 text-[0.9375rem] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  {description}
                </p>
              ) : null}

              {links.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {links.map((link) => (
                    // Todos em `_blank`, como antes (num `tel:` não faz
                    // nada de útil; fica por consistência).
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      title={link.label}
                      className="menu-contact"
                    >
                      {link.icon}
                    </a>
                  ))}
                </div>
              ) : null}

              {addressText ? (
                <p className="mt-3 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  {addressText}
                </p>
              ) : null}

              <ul className="mt-6 flex flex-col gap-2" aria-label="O que fazer aqui">
                {googleReviewUrl ? (
                  <li>
                    <a className="menu-block menu-action" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">
                      <span className="menu-action-icon is-brand" aria-hidden="true"><FcGoogle /></span>
                      <span className="menu-action-label">Avaliar no Google</span>
                      <LuChevronRight className="menu-action-chevron" aria-hidden="true" />
                    </a>
                  </li>
                ) : null}
                {hasDishes ? (
                  <li>
                    <button type="button" className="menu-block menu-action" onClick={onViewMenu}>
                      <span className="menu-action-icon" aria-hidden="true"><LuBookOpen /></span>
                      <span className="menu-action-label">Ver cardápio</span>
                      <LuChevronRight className="menu-action-chevron" aria-hidden="true" />
                    </button>
                  </li>
                ) : null}
                <li>
                  <button type="button" className="menu-block menu-action" aria-haspopup="dialog" onClick={onOpenFeedback}>
                    <span className="menu-action-icon" aria-hidden="true"><LuMessageSquareText /></span>
                    <span className="menu-action-label">Deixar feedback anônimo</span>
                    <LuChevronRight className="menu-action-chevron" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* A dica é sobre o GESTO, não sobre o restaurante: fica no rodapé. */}
          <div className="mx-auto w-full max-w-[720px] shrink-0 px-5 pb-10">
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--m-muted)' }}>
              Deslize para ver o cardápio →
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
