import { comparableText } from '@/domain/common'
import { MAX_CATEGORIES_PER_BATCH, MAX_ITEMS_PER_BATCH, type OwnerMenuCategoryDTO } from '@/domain/menu'
import { emptyDraft, hasErrors, validateDraft, type DraftErrors, type ItemDraft } from './item-draft'

export type NewMenuCategoryDraft = {
  id: string
  name: string
  description: string
}

export type BulkItemDraft = {
  id: string
  initialCategoryId: string
  values: ItemDraft
  expanded: boolean
}

export type BulkDraftErrors = DraftErrors & {
  category?: string
  dietaryTags?: string
}

export type BulkValidation = {
  errors: Record<string, BulkDraftErrors>
  valid: boolean
  firstInvalidId: string | null
}

export function createBulkItem(categoryId: string, expanded = false): BulkItemDraft {
  return { id: crypto.randomUUID(), initialCategoryId: categoryId, values: emptyDraft(categoryId), expanded }
}

export function createBulkCategory(): NewMenuCategoryDraft {
  return { id: crypto.randomUUID(), name: '', description: '' }
}

export function validateBulkMenuDraft(
  rows: BulkItemDraft[],
  categories: OwnerMenuCategoryDTO[],
  newCategories: NewMenuCategoryDraft[],
): BulkValidation {
  const errors: Record<string, BulkDraftErrors> = {}
  const categoryIds = new Set([...categories.map((category) => category.id), ...newCategories.map((category) => category.id)])

  if (rows.length > MAX_ITEMS_PER_BATCH) {
    errors.__batch = { name: `Use no máximo ${MAX_ITEMS_PER_BATCH} itens por lote.` }
  }
  if (rows.length === 0 && newCategories.length === 0) {
    errors.__batch = { name: 'Adicione um item ou uma categoria nova para criar o lote.' }
  }
  if (newCategories.length > MAX_CATEGORIES_PER_BATCH) {
    errors.__categories = { name: `Use no máximo ${MAX_CATEGORIES_PER_BATCH} categorias novas por lote.` }
  }

  const categoryNames = new Set<string>()
  newCategories.forEach((category) => {
    const name = category.name.trim()
    const key = comparableText(name)
    if (name.length < 2 || name.length > 80 || /[<>]/.test(name)) {
      errors[`category:${category.id}`] = { name: 'Use um nome de 2 a 80 caracteres, sem < ou >.' }
    } else if (categoryNames.has(key)) {
      errors[`category:${category.id}`] = { name: 'Este nome já aparece nas categorias novas.' }
    }
    categoryNames.add(key)
  })

  for (const row of rows) {
    const rowErrors: BulkDraftErrors = { ...validateDraft(row.values) }
    if (!categoryIds.has(row.values.categoryId)) rowErrors.category = 'Escolha uma categoria.'
    if (row.values.dietaryTags.length > 10 || row.values.dietaryTags.some((tag) => tag.trim().length > 30 || /[<>]/.test(tag))) {
      rowErrors.dietaryTags = 'Use até 10 destaques, com no máximo 30 caracteres cada.'
    }
    if (Object.keys(rowErrors).length > 0) errors[row.id] = rowErrors
  }

  const firstInvalidRow = rows.find((row) => hasErrors(errors[row.id] ?? {}))?.id
  const firstInvalidCategory = newCategories.find((category) => hasErrors(errors[`category:${category.id}`] ?? {}))?.id
  const firstInvalidId = firstInvalidRow ?? (firstInvalidCategory ? `category:${firstInvalidCategory}` : null)
  return { errors, valid: Object.keys(errors).length === 0, firstInvalidId }
}
