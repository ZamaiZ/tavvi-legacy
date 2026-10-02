import { comparableText } from '@/domain/common'
import { MAX_CATEGORIES_PER_BATCH } from '@/domain/menu'

export type CategoryRowDraft = { key: string; name: string; description: string }

export function newCategoryRow(name = ''): CategoryRowDraft {
  return { key: crypto.randomUUID(), name, description: '' }
}

// Texto colado com várias linhas vira uma categoria por linha. Marcadores
// comuns de lista ("-", "•", "1.") saem junto com o espaço.
export function splitPastedNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
}

// A primeira linha colada entra na linha atual, se ela estiver sem nome; as
// demais entram logo depois. O que passar do teto do lote fica de fora, e
// quem chama avisa quantas.
export function insertPastedNames(
  rows: CategoryRowDraft[],
  rowKey: string,
  names: string[],
): { rows: CategoryRowDraft[]; dropped: number } {
  const index = rows.findIndex((row) => row.key === rowKey)
  if (index < 0 || names.length === 0) return { rows, dropped: 0 }

  const next = [...rows]
  const queue = [...names]
  if (!next[index].name.trim()) {
    next[index] = { ...next[index], name: queue.shift() ?? '' }
  }
  const room = Math.max(0, MAX_CATEGORIES_PER_BATCH - next.length)
  const accepted = queue.slice(0, room)
  next.splice(index + 1, 0, ...accepted.map((name) => newCategoryRow(name)))
  return { rows: next, dropped: queue.length - accepted.length }
}

// Linha inteiramente vazia é ignorada (sobra do "Enter" no fim). As demais
// seguem as regras do servidor, com a mensagem na própria linha.
export function validateCategoryRows(rows: CategoryRowDraft[]): {
  valid: { name: string; description?: string }[]
  errors: Record<string, string>
} {
  const valid: { name: string; description?: string }[] = []
  const errors: Record<string, string> = {}
  const seen = new Set<string>()

  for (const row of rows) {
    const name = row.name.trim()
    const description = row.description.trim()
    if (!name && !description) continue

    if (name.length < 2) errors[row.key] = 'Mínimo de 2 caracteres no nome.'
    else if (name.length > 80) errors[row.key] = 'Máximo de 80 caracteres no nome.'
    else if (description.length > 300) errors[row.key] = 'Máximo de 300 caracteres na descrição.'
    else if (/[<>]/.test(name) || /[<>]/.test(description)) errors[row.key] = 'Não são permitidos os caracteres < e >.'
    else if (seen.has(comparableText(name))) errors[row.key] = `Nome repetido neste lote: '${name}'.`

    seen.add(comparableText(name))
    if (!errors[row.key]) valid.push({ name, description: description || undefined })
  }
  return { valid, errors }
}
