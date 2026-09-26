// Deriva o endereço público a partir do nome do restaurante.
//
// Roda no servidor E no navegador: o assistente mostra o endereço enquanto a
// pessoa digita, e o servidor valida de novo antes de gravar. As duas pontas
// usam ESTA função, para não existir a chance de discordarem.

// A mesma lista do CHECK `restaurants_slug_not_reserved`, no 0003, e do
// `is_slug_available`, no 0013. Se uma mudar, as três precisam mudar junto.
export const RESERVED_SLUGS = new Set([
  'admin',
  'painel',
  'api',
  't',
  'entrar',
  'convite',
  'assets',
  'static',
  'public',
  'favicon',
  'robots',
  'sitemap',
])

export function slugify(name: string): string {
  let base = name
    // NFD separa a letra do acento; o intervalo abaixo remove o acento e
    // deixa a letra. É assim que "Zé" vira "ze" sem tabela de substituição.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // O `+` já colapsa repetições: "Bar   &   Grill" vira "bar-grill", e não
    // "bar---grill".
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // O CHECK no banco permite 50 caracteres e exige terminar em alfanumérico,
  // então o corte não pode deixar hífen na ponta.
  if (base.length > 50) base = base.slice(0, 50).replace(/-+$/, '')

  // E exige no mínimo 3. "Zé" sozinho não passaria.
  if (base.length < 3) base = base.length > 0 ? `${base}-menu` : 'restaurante'

  // Um restaurante chamado "Admin" não pode virar o endereço do console.
  if (RESERVED_SLUGS.has(base)) base = `${base}-1`

  return base
}

// Usada quando o endereço derivado já existe. Sufixa e devolve o candidato
// seguinte, respeitando o teto de 50 caracteres.
export function nextSlugCandidate(slug: string, attempt: number): string {
  const suffix = `-${attempt}`
  const room = 50 - suffix.length
  return `${slug.slice(0, room).replace(/-+$/, '')}${suffix}`
}
