import type { RequestHandler } from 'express'
import { ok } from '../../http/responses.js'
import { requireAdminContext } from '../../http/request-context.js'
import { getPlatformAppearance, updatePlatformAppearance } from './appearance.service.js'

export const getPlatformAppearanceController: RequestHandler = async (_request, response, next) => {
  try {
    const appearance = await getPlatformAppearance()
    const etag = `W/"${appearance.schemaVersion}-${appearance.updatedAt}-${appearance.source.brandAccent}-${appearance.source.onAccentOverride ?? 'auto'}"`
    response.setHeader('ETag', etag)
    response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
    if (_request.header('if-none-match') === etag) { response.status(304).end(); return }
    ok(response, appearance)
  } catch (error) { next(error) }
}

export const updatePlatformAppearanceController: RequestHandler = async (request, response, next) => {
  try { ok(response, await updatePlatformAppearance(requireAdminContext(request), request.body)) }
  catch (error) { next(error) }
}
