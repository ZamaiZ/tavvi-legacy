import { Ban } from 'lucide-react-native'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'

export function RevokeDialog({ visible, loading, onCancel, onConfirm }: { visible: boolean; loading: boolean; onCancel(): void; onConfirm(): void }) {
  return (
    <ConfirmDialog
      visible={visible}
      loading={loading}
      title="Revogar convite?"
      description="O link deixará de funcionar imediatamente."
      confirmLabel="Revogar"
      destructive
      icon={Ban}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
