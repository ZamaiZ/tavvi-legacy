import { z } from 'zod'

export const MENU_PRESENTATIONS = [
  'immersive',
  'catalog-list',
  'catalog-grid',
] as const

export const DEFAULT_MENU_PRESENTATION = 'immersive' as const

export type MenuPresentation = (typeof MENU_PRESENTATIONS)[number]

export const menuPresentationSchema = z.enum(MENU_PRESENTATIONS)

export function parseMenuPresentation(raw: unknown): MenuPresentation {
  return menuPresentationSchema.catch(DEFAULT_MENU_PRESENTATION).parse(raw)
}
