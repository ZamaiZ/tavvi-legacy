import 'server-only'
import { recordTableOrderResultSchema, recordTableOrderSchema, type RecordTableOrderResult } from '@/domain/orders'
import { myRole, requireUser, UserFacingError } from './auth'
import { createUserClient } from './_client'
import { currentTerritory } from './auth'

export async function recordTableOrder(input: unknown): Promise<RecordTableOrderResult> {
  const data = recordTableOrderSchema.parse(input)
  const [user, role] = await Promise.all([requireUser(), myRole(data.restaurantId)])
  if (!role) {
    throw new UserFacingError('Você não tem acesso a este restaurante.')
  }

  const supabase = await createUserClient(await currentTerritory())
  const { data: call, error: callError } = await supabase
    .from('service_calls')
    .select('id, restaurant_id, table_number, status, assigned_to')
    .eq('id', data.callId)
    .eq('restaurant_id', data.restaurantId)
    .maybeSingle()
  if (callError) throw new Error(`Não foi possível conferir o chamado: ${callError.message}`)
  if (!call) throw new UserFacingError('O chamado não está mais disponível.')
  if (call.status !== 'in_progress' || call.assigned_to !== user.id) {
    throw new UserFacingError('Este chamado não está mais atribuído a você. Atualize a fila antes de tentar novamente.')
  }

  const { data: result, error } = await supabase.rpc('record_table_order', {
    p_call_id: data.callId,
    p_request_id: data.requestId,
    p_items: data.items.map((item) => ({
      itemId: item.itemId,
      variantId: item.variantId,
      quantity: item.quantity,
      expectedUnitPriceCents: item.expectedUnitPriceCents,
      note: item.note,
    })),
  })
  if (error) {
    const message = error.message
    if (message.includes('service_call_not_found')) throw new UserFacingError('O chamado não está mais disponível.')
    if (message.includes('checkout_settings_missing')) throw new UserFacingError('As configurações do caixa não estão disponíveis para este restaurante.')
    if (message.includes('order_input_invalid')) throw new UserFacingError('Confira os itens e quantidades do pedido antes de confirmar.')
    if (message.includes('account_total_too_large')) throw new UserFacingError('O total da comanda excede o limite permitido para esta conta.')
    if (message.includes('forbidden')) throw new UserFacingError('Você não tem permissão para registrar este pedido.')
    if (message.includes('call_conflict')) throw new UserFacingError('O chamado mudou de responsável ou foi concluído antes da gravação.')
    if (message.includes('menu_stale')) throw new UserFacingError('Um item ou preço mudou. Atualize o cardápio antes de confirmar novamente.')
    if (message.includes('menu_variant_required')) throw new UserFacingError('Escolha uma variação para cada item que exige essa opção.')
    if (message.includes('account_settling')) throw new UserFacingError('A conta desta mesa está em fechamento e não aceita novos pedidos.')
    if (message.includes('account_closed')) throw new UserFacingError('A conta desta mesa já foi encerrada.')
    if (message.includes('duplicate_request')) throw new UserFacingError('Esta confirmação conflitou com outra solicitação. Atualize a mesa antes de tentar novamente.')
    throw new Error(`Não foi possível registrar o pedido: ${message}`)
  }

  const parsed = recordTableOrderResultSchema.safeParse(result)
  if (!parsed.success) throw new Error('O servidor retornou um resumo de conta inválido após registrar o pedido.')
  return parsed.data
}
