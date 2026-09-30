import { Redirect } from 'expo-router'

// A aba Conta abre um sheet (ver _layout.tsx) e nunca navega para cá. A rota
// existe porque a aba precisa de destino; um link direto volta para Convites.
export default function AccountRoute() {
  return <Redirect href="/" />
}
