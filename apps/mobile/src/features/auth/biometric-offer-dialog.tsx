import { Fingerprint, ScanFace } from 'lucide-react-native'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/primitives/confirm-dialog'
import { toast } from '@/components/primitives/toast'
import { useAuth } from './auth-context'

// Oferta depois de cada login com senha (spec 2026-10-01): "Agora não" vale
// só para esta vez. A falha fica num diálogo, porque a causa não cabe no
// toast de uma linha.
export function BiometricOfferDialog() {
  const { status, biometricOffer, acceptBiometricOffer, dismissBiometricOffer } = useAuth()
  const [failure, setFailure] = useState<string | null>(null)
  const Icon = biometricOffer?.kind === 'face' ? ScanFace : Fingerprint

  async function activate() {
    const activated = biometricOffer?.activated
    try {
      const result = await acceptBiometricOffer()
      if (result === 'enabled' && activated) toast.show(activated)
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : 'Não foi possível ativar a digital neste aparelho.')
    }
  }

  return (
    <>
      <ConfirmDialog
        visible={status === 'authenticated' && biometricOffer !== null}
        title={`Entrar com ${biometricOffer?.phrase ?? 'a digital'} da próxima vez?`}
        description="Você entra na Tavvi com a biometria do celular, sem digitar a senha. Dá para desativar na tela de login."
        confirmLabel="Ativar"
        cancelLabel="Agora não"
        icon={Icon}
        onCancel={dismissBiometricOffer}
        onConfirm={() => void activate()}
      />
      <ConfirmDialog
        visible={failure !== null}
        title="Digital não ativada"
        description={failure ?? ''}
        confirmLabel="Entendi"
        showCancel={false}
        icon={Icon}
        onCancel={() => setFailure(null)}
        onConfirm={() => setFailure(null)}
      />
    </>
  )
}
