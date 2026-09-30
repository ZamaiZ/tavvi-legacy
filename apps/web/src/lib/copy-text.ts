import { toast } from '@/components/ui/toast'

// Copia e avisa. Sem permissão da área de transferência, o toast de erro
// explica; o texto continua na tela para copiar à mão.
export async function copyText(value: string, done: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: done, type: 'success' })
  } catch {
    toast.add({ title: 'Não foi possível copiar.', type: 'error' })
  }
}
