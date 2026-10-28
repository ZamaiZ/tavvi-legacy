import type { NavGroup, NavItem, NavLeaf } from './navigation.types'
import type { MemberRole } from '@/domain/invite'
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
  role: MemberRole | null,
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
    {
      kind: 'leaf',
      href: `${root}/service-calls`,
      label: 'Chamados',
      icon: 'bell',
      description: 'Chamados de atendimento por mesa',
    },
  ]

  if (role) {
    children.push({
      kind: 'leaf',
      href: `${root}/cash`,
      label: 'Caixa',
      icon: 'cash',
      description: 'Comandas, pagamentos e fechamento por mesa',
      keywords: ['conta', 'comanda', 'recebimento', 'pagamento'],
    })
  }

  if (role === 'admin' || role === 'cashier') {
    children.push({
      kind: 'leaf',
      href: `${root}/financeiro`,
      label: 'Financeiro',
      icon: 'cash',
      description: 'Acompanhe recebimentos e o caixa do dia',
      keywords: ['caixa diário', 'fundo inicial', 'fechamento', 'movimentações'],
    })
  }

  if (role === 'admin') {
    children.push(
      {
        kind: 'leaf',
        href: `${root}/identificadores`,
        label: 'Identificadores',
        icon: 'tag',
        description: 'Associe cada identificador a uma mesa',
      },
      {
        kind: 'leaf',
        href: `${root}/feedbacks`,
        label: 'Feedbacks',
        icon: 'feedback',
        description: 'Comentários e fotos dos clientes',
        keywords: ['avaliação', 'reclamação', 'opinião', 'cliente'],
      },
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
      description: 'Cardápio e operações',
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

// Só o endereço MAIS específico acende. O Cardápio é `/restaurantes/{id}`, que
// é prefixo de Identidade, Contato e Equipe; por prefixo simples ele ficaria
// marcado junto com qualquer outra página do restaurante.
export function pickActiveHref(pathname: string, hrefs: readonly string[]) {
  const current = externalPathname(pathname)
  return hrefs
    .filter((href) => isHrefActive(current, href))
    .sort((a, b) => b.length - a.length)[0]
}

// Primeiros passos não tem item próprio na navegação: o passo de identidade
// acende Identidade e o de contato acende Contato (README §6.1).
export function navigationPathname(pathname: string, step: string | null) {
  const match = /^\/restaurantes\/([^/]+)\/comecar\/?$/.exec(externalPathname(pathname))
  if (!match) return pathname
  return `/restaurantes/${match[1]}/${step === 'contato' ? 'contato' : 'identidade'}`
}

export function getActiveHref(pathname: string, items: NavItem[]) {
  return pickActiveHref(pathname, flattenNavItems(items).map((item) => item.href))
}

export function isGroupActive(pathname: string, group: NavGroup) {
  const activeHref = getActiveHref(pathname, group.children)
  return group.children.some((item) => item.href === activeHref)
}
