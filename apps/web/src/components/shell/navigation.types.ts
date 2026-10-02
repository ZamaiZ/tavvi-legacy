export type NavIconName =
  | 'mail'
  | 'store'
  | 'restaurant'
  | 'menu'
  | 'palette'
  | 'contact'
  | 'team'
  | 'feedback'

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

export type MobileTabIcon = 'mail' | 'store' | 'menu' | 'service' | 'feedback' | 'team' | 'settings'

// Aba da tab bar do celular. `exact` acende só na rota exata (o Cardápio é
// prefixo de todas as outras); `match` acende também em outras rotas
// (Ajustes em Identidade e Contato).
export type MobileTab = {
  key: string
  href: string
  label: string
  icon: MobileTabIcon
  match?: string[]
  exact?: boolean
  badge?: number
}

export type TavviShellConfig = {
  homeHref: string
  userLabel: string | null
  /** Nome da conta (profiles.display_name), editável no popover de conta. */
  userName?: string | null
  contextLabel?: string
  contextDescription?: string
  items: NavItem[]
}
