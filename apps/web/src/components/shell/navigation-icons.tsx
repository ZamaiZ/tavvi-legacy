import type { IconType } from 'react-icons'
import {
  RiBookOpenLine,
  RiContactsLine,
  RiMailLine,
  RiPaletteLine,
  RiRestaurantLine,
  RiStore2Line,
  RiTeamLine,
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
}

export function getNavIcon(name: NavIconName) {
  return NAV_ICONS[name]
}
