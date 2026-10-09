export type NavIconName =
  | 'mail'
  | 'store'
  | 'restaurant'
  | 'menu'
  | 'palette'
  | 'contact'
  | 'team'
  | 'feedback'
  | 'tag'
  | 'bell'
  | 'service'

export type NavLeaf = {
  kind: 'leaf'
  label: string
  href: string
  icon: NavIconName
  description?: string
  keywords?: string[]
  disabled?: boolean
}

export type NavGroup = {
  kind: 'group'
  id: string
  label: string
  icon: NavIconName
  description?: string
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavGroup

export type TavviShellConfig = {
  homeHref: string
  userLabel: string | null
  /** Nome da conta (profiles.display_name), editável no popover de conta. */
  userName?: string | null
  contextLabel?: string
  contextDescription?: string
  items: NavItem[]
}
