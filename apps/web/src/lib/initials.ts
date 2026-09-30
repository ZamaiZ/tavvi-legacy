// Iniciais de restaurante, como no protótipo: as duas primeiras palavras que
// contam (mais de duas letras, ou com inicial maiúscula). "Cantina do Zé" → "CZ".
export function restaurantInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(word))
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'R'
}

// Iniciais de pessoa, como no protótipo: nome e sobrenome ou, sem nome, a
// parte do e-mail antes do domínio ("caixa@…" → "C"). Duas letras no máximo.
export function personInitials({ displayName, email }: { displayName: string | null; email: string | null }): string {
  const source = displayName ?? (email ?? '').replace(/@.*/, '')
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}
