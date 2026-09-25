import type { RequestHandler } from 'express'
import { ok } from '../../http/responses.js'
import { requireAdminContext } from '../../http/request-context.js'
import { deviceContractLoginSchema, deviceContractRegistrationSchema, refreshSchema, signInSchema } from './auth.schemas.js'
import { getSession, refreshSession, signIn, signOut } from './auth.service.js'
import { registerDeviceContract, revokeDeviceContract, signInWithDeviceContract } from './device-contract.service.js'

export const signInController: RequestHandler = async (request, response, next) => {
  try {
    const input = signInSchema.parse(request.body)
    const session = await signIn(input, request.ip || null)
    ok(response, session)
  } catch (error) { next(error) }
}

export const refreshController: RequestHandler = async (request, response, next) => {
  try {
    const input = refreshSchema.parse(request.body)
    ok(response, await refreshSession(input))
  } catch (error) { next(error) }
}

export const getSessionController: RequestHandler = (request, response, next) => {
  try { ok(response, getSession(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const signOutController: RequestHandler = async (request, response, next) => {
  try { ok(response, await signOut(requireAdminContext(request))) }
  catch (error) { next(error) }
}

export const registerDeviceContractController: RequestHandler = async (request, response, next) => {
  try {
    const input = deviceContractRegistrationSchema.parse(request.body)
    ok(response, await registerDeviceContract(requireAdminContext(request), input))
  } catch (error) { next(error) }
}

export const deviceContractLoginController: RequestHandler = async (request, response, next) => {
  try {
    const input = deviceContractLoginSchema.parse(request.body)
    ok(response, await signInWithDeviceContract(input, request.ip || null))
  } catch (error) { next(error) }
}

export const revokeDeviceContractController: RequestHandler = async (request, response, next) => {
  try {
    const input = deviceContractLoginSchema.parse(request.body)
    ok(response, await revokeDeviceContract(input, request.ip || null))
  } catch (error) { next(error) }
}
