import type { SupabaseClient } from '@supabase/supabase-js'
import type { Request } from 'express'
import type { Database } from '../integrations/supabase/database.types.js'

export type AdminContext = {
  accessToken: string
  user: { id: string; email: string }
  supabase: SupabaseClient<Database>
  trustedIp: string | null
}

declare global {
  namespace Express {
    interface Request {
      adminContext?: AdminContext
    }
  }
}

export function requireAdminContext(request: Request): AdminContext {
  if (!request.adminContext) throw new Error('Authenticated request context is missing.')
  return request.adminContext
}
