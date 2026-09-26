import type { NavGroup, NavItem, NavLeaf } from './navigation.types'
import { toExternalPath } from '@/lib/route-paths'

export function getAdminNavigation(): NavItem[] {
  return [
    {
      kind: 'group',
      id: 'platform',
      label: 'Plataforma',
      icon: 'store',
      description: 'Convites e restaurantes',
      children: [
        {
          kind: 'leaf',
          href: '/',
          label: 'Convites',
          icon: 'mail',
          description: 'Gerencie acessos à plataforma',
          keywords: ['acesso', 'e-mail'],
        },
        {
          kind: 'leaf',
          href: '/restaurantes',
          label: 'Restaurantes',
          icon: 'store',
          description: 'Consulte os restaurantes cadastrados',
          keywords: ['estabelecimentos', 'contas'],
        },
      ],
    },
  ]
}

export function getPanelNavigation(): NavItem[] {
  return [
    {
      kind: 'group',
      id: 'manage',
      label: 'Gerenciar',
      icon: 'store',
      description: 'Acesso aos restaurantes',
      children: [
        {
          kind: 'leaf',
          href: '/restaurantes',
          label: 'Restaurantes',
          icon: 'store',
          description: 'Escolha um restaurante para gerenciar',
        },
      ],
    },
  ]
}

export function getRestaurantNavigation(
  restaurantId: string,
  canEdit: boolean,
): NavItem[] {
  const root = `/restaurantes/${restaurantId}`
  const children: NavLeaf[] = [
    {
      kind: 'leaf',
      href: root,
      label: 'Cardápio',
      icon: 'menu',
      description: 'Categorias, itens e publicação',
      keywords: ['menu', 'produto', 'preço'],
    },
  ]

  if (canEdit) {
    children.push(
      {
        kind: 'leaf',
        href: `${root}/identidade`,
        label: 'Identidade',
        icon: 'palette',
        description: 'Marca, cores, fontes e imagens',
        keywords: ['tema', 'logo', 'aparência'],
      },
      {
        kind: 'leaf',
        href: `${root}/contato`,
        label: 'Contato',
        icon: 'contact',
        description: 'Informações públicas do restaurante',
        keywords: ['telefone', 'endereço', 'redes'],
      },
      {
        kind: 'leaf',
        href: `${root}/equipe`,
        label: 'Equipe',
        icon: 'team',
        description: 'Membros, papéis e convites',
        keywords: ['pessoas', 'permissões', 'acessos'],
      },
    )
  }

  return [
    {
      kind: 'group',
      id: 'restaurant',
      label: 'Restaurante',
      icon: 'restaurant',
      description: 'Cardápio e configurações',
      children,
    },
  ]
}

export function externalPathname(pathname: string) {
  return toExternalPath(pathname)
}

export function isHrefActive(pathname: string, href: string) {
  const current = externalPathname(pathname)
  return current === href || current.startsWith(`${href}/`)
}

export function flattenNavItems(items: NavItem[]): NavLeaf[] {
  return items.flatMap((item) => (item.kind === 'leaf' ? [item] : item.children))
}

export function getActiveHref(pathname: string, items: NavItem[]) {
  const current = externalPathname(pathname)
  return flattenNavItems(items)
    .filter((item) => isHrefActive(current, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

export function isGroupActive(pathname: string, group: NavGroup) {
  const activeHref = getActiveHref(pathname, group.children)
  return group.children.some((item) => item.href === activeHref)
}
