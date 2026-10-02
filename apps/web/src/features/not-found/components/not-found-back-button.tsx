'use client'

import { useRouter } from 'next/navigation'
import { LuArrowLeft } from 'react-icons/lu'

// `history.length` conta também as entradas À FRENTE: numa aba nova, depois
// de ir à ação principal e voltar pelo navegador, ele vale 2 sem nada atrás,
// e router.back() não faria nada. A Navigation API (`navigation.canGoBack`)
// responde exatamente isso; onde ela não existe, o tamanho do histórico é a
// melhor aproximação.
function canGoBack(): boolean {
  const { navigation } = window as Window & { navigation?: { canGoBack: boolean } }
  return navigation ? navigation.canGoBack : window.history.length > 1
}

// Aparece sempre, para nada pular de lugar depois da hidratação. Sem
// histórico (aba nova, link aberto pela plaquinha NFC, app instalado, que
// não tem botão de voltar do navegador), não há para onde voltar, e a saída
// é o destino da ação principal.
export function NotFoundBackButton({
  fallbackHref,
  className,
}: {
  fallbackHref: string
  className?: string
}) {
  const router = useRouter()

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (canGoBack()) router.back()
        else router.push(fallbackHref)
      }}
    >
      <LuArrowLeft aria-hidden="true" />
      Voltar
    </button>
  )
}
