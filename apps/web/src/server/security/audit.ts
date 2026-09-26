import 'server-only'
import { createUserClient } from '@/server/dal/_client'
import { currentTerritory } from '@/server/dal/auth'
import { clientIp } from './client-ip'

// Valores simples, de proposito. A coluna e jsonb, e aceitar
// Record<string, unknown> deixaria passar Date, funcao ou classe -- que
// serializam mal ou nem serializam, e so quebrariam na hora de gravar.
type AuditMetadata = Record<string, string | number | boolean | null>

export async function recordAudit(input: {
  action: string
  subjectType: string
  subjectId?: string
  restaurantId?: string
  metadata?: AuditMetadata
}): Promise<void> {
  const supabase = await createUserClient(await currentTerritory())

  await supabase.rpc('record_audit', {
    p_action: input.action,
    p_subject_type: input.subjectType,
    // undefined omite o parametro e deixa o default do SQL (null) valer.
    // Mandar null explicito daria no mesmo, mas o tipo gerado pede opcional.
    p_subject_id: input.subjectId ?? undefined,
    p_restaurant_id: input.restaurantId ?? undefined,
    p_metadata: input.metadata ?? {},
    // Omitido quando o IP nao pode ser determinado. A coluna e inet e
    // recusaria uma string que nao seja endereco.
    p_ip: (await clientIp()) ?? undefined,
  })
}
