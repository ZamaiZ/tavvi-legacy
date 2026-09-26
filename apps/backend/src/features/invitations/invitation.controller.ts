import type { RequestHandler } from 'express'
import { ok } from '../../http/responses.js'
import { requireAdminContext } from '../../http/request-context.js'
import { createInvitation, getInvitation, listInvitations, revokeInvitation, rotateInvitation } from './invitation.service.js'

export const listInvitationsController: RequestHandler = async (request, response, next) => {
  try { ok(response, await listInvitations(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const createInvitationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await createInvitation(requireAdminContext(request), request.body), 201) }
  catch (error) { next(error) }
}

export const getInvitationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await getInvitation(requireAdminContext(request), request.params.id ?? '')) }
  catch (error) { next(error) }
}

export const rotateInvitationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await rotateInvitation(requireAdminContext(request), request.params.id ?? '')) }
  catch (error) { next(error) }
}

export const revokeInvitationController: RequestHandler = async (request, response, next) => {
  try { ok(response, await revokeInvitation(requireAdminContext(request), request.params.id ?? '')) }
  catch (error) { next(error) }
}
