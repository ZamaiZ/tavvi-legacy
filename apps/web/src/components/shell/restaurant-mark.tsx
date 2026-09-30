import type { RestaurantSwitchEntry } from './console-config'

// Logo do restaurante ou, sem logo, as iniciais. Tamanho, raio e cores vêm
// da classe de quem usa (sheet do celular, popover do sidebar).
export function RestaurantMark({ entry, className }: { entry: Pick<RestaurantSwitchEntry, 'logoUrl' | 'initials'>; className: string }) {
  if (entry.logoUrl) {
    return (
      <span className={`${className} is-logo`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.logoUrl} alt="" />
      </span>
    )
  }
  return <span className={className} aria-hidden="true">{entry.initials}</span>
}
