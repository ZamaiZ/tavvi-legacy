export type ConsoleIcon = 'mail' | 'store' | 'menu' | 'palette' | 'contact' | 'team'

export type ConsoleLeaf = {
  kind: 'leaf'
  key: string
  href: string
  activeMatch: string[]
  label: string
  sub: string
  icon: ConsoleIcon
}

export type ConsoleGroup = {
  kind: 'group'
  id: string
  label: string
  children: ConsoleLeaf[]
}

export type ConsoleNode = ConsoleLeaf | ConsoleGroup

export type ConsoleConfig = {
  userLabel: string | null
  items: ConsoleNode[]
  leaves: ConsoleLeaf[]
  contextLabel?: string | null
  contextDescription?: string | null
  userDescription?: string | null
  homeHref?: string
  showNewInvite?: boolean
  counts?: { pendingInvites: number; restaurants: number }
  railWidths?: { collapsed: number; pinned: number }
}

export function getConsoleConfig(user: { email?: string | null } | null): ConsoleConfig {
  const leaves: ConsoleLeaf[] = [
    {
      kind: 'leaf',
      key: 'invites',
      href: '/',
      activeMatch: ['/convites'],
      label: 'Convites',
      sub: 'Acessos à plataforma',
      icon: 'mail',
    },
    {
      kind: 'leaf',
      key: 'restaurants',
      href: '/restaurantes',
      activeMatch: ['/restaurantes'],
      label: 'Restaurantes',
      sub: 'Contas cadastradas',
      icon: 'store',
    },
  ]

  return {
    userLabel: user?.email ?? null,
    items: [{ kind: 'group', id: 'platform', label: 'Plataforma', children: leaves }],
    leaves,
    contextLabel: 'TAVVI',
    contextDescription: 'Console',
    userDescription: 'Administrador da plataforma',
    homeHref: '/',
    showNewInvite: true,
    railWidths: { collapsed: 60, pinned: 232 },
  }
}

export function getRestaurantConsoleConfig({
  email,
  roleLabel,
  restaurantName,
  homeHref,
  navigation,
}: {
  email: string | null
  roleLabel: string
  restaurantName: string
  homeHref: string
  navigation: { kind: 'group'; id: string; label: string; children: { kind: 'leaf'; href: string; label: string; icon: string; description?: string }[] }[]
}): ConsoleConfig {
  const iconMap = { menu: 'menu', palette: 'palette', contact: 'contact', team: 'team' } as const
  const leaves = navigation.flatMap((group) => group.children).map((leaf) => ({
    kind: 'leaf' as const,
    key: leaf.icon,
    href: leaf.href,
    activeMatch: [],
    label: leaf.label,
    sub: leaf.description ?? '',
    icon: iconMap[leaf.icon as keyof typeof iconMap],
  }))

  return {
    userLabel: email,
    userDescription: `${roleLabel} · ${restaurantName}`,
    contextLabel: 'Painel',
    contextDescription: restaurantName,
    homeHref,
    items: [{ kind: 'group', id: 'restaurant', label: 'Restaurante', children: leaves }],
    leaves,
    showNewInvite: false,
    counts: { pendingInvites: 0, restaurants: 0 },
    railWidths: { collapsed: 60, pinned: 232 },
  }
}

export function isConsoleLeaf(node: ConsoleNode): node is ConsoleLeaf {
  return node.kind === 'leaf'
}

function routePrefixMatches(pathname: string, prefix: string) {
  const route = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const normalizedPrefix = prefix.length > 1 ? prefix.replace(/\/+$/, '') : prefix
  if (normalizedPrefix === '/') return route === '/'
  return route === normalizedPrefix || route.startsWith(`${normalizedPrefix}/`)
}

export function getActiveConsoleLeaf(pathname: string, leaves: ConsoleLeaf[]) {
  let activeLeaf: ConsoleLeaf | undefined
  let activeSpecificity = -1

  for (const leaf of leaves) {
    const specificity = [leaf.href, ...leaf.activeMatch]
      .filter((prefix) => routePrefixMatches(pathname, prefix))
      .reduce((longest, prefix) => Math.max(longest, prefix === '/' ? 1 : prefix.length), -1)

    if (specificity > activeSpecificity) {
      activeLeaf = leaf
      activeSpecificity = specificity
    }
  }

  return activeLeaf
}
