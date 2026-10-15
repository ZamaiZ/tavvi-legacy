import type { IconType } from 'react-icons'
import {
  RiBookOpenLine,
  RiContactsLine,
  RiMailLine,
  RiPaletteLine,
  RiRestaurantLine,
  RiStore2Line,
  RiMessage2Line,
  RiTeamLine,
  RiQrCodeLine,
  RiNotification3Line,
} from 'react-icons/ri'
import type { NavIconName } from './navigation.types'

export const NAV_ICONS: Record<NavIconName, IconType> = {
  mail: RiMailLine,
  store: RiStore2Line,
  restaurant: RiRestaurantLine,
  menu: RiBookOpenLine,
  palette: RiPaletteLine,
  contact: RiContactsLine,
  team: RiTeamLine,
  feedback: RiMessage2Line,
  tag: RiQrCodeLine,
  bell: RiNotification3Line,
}

export function getNavIcon(name: NavIconName) {
  return NAV_ICONS[name]
}
