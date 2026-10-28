import type { IconType } from 'react-icons'
import {
  RiBookOpenLine,
  RiContactsLine,
  RiMailLine,
  RiPaletteLine,
  RiRestaurantLine,
  RiStore2Line,
  RiTeamLine,
  RiQrCodeLine,
  RiNotification3Line,
  RiMoneyDollarCircleLine,
  RiFundsLine,
} from 'react-icons/ri'
import { VscFeedback } from 'react-icons/vsc'
import type { NavIconName } from './navigation.types'

export const NAV_ICONS: Record<NavIconName, IconType> = {
  mail: RiMailLine,
  store: RiStore2Line,
  restaurant: RiRestaurantLine,
  menu: RiBookOpenLine,
  palette: RiPaletteLine,
  contact: RiContactsLine,
  team: RiTeamLine,
  feedback: VscFeedback,
  tag: RiQrCodeLine,
  bell: RiNotification3Line,
  cash: RiMoneyDollarCircleLine,
  finance: RiFundsLine,
}

export function getNavIcon(name: NavIconName) {
  return NAV_ICONS[name]
}
