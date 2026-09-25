import { Router } from 'express'
import { requirePlatformAdmin } from '../../http/auth.middleware.js'
import {
  createInvitationController,
  getInvitationController,
  listInvitationsController,
  revokeInvitationController,
  rotateInvitationController,
} from './invitation.controller.js'

export const invitationRouter = Router()

invitationRouter.use(requirePlatformAdmin)
invitationRouter.get('/', listInvitationsController)
invitationRouter.post('/', createInvitationController)
invitationRouter.get('/:id', getInvitationController)
invitationRouter.post('/:id/revoke', revokeInvitationController)
invitationRouter.post('/:id', rotateInvitationController)
