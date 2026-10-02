import { NotFoundScreen } from '@/features/not-found/not-found-screen'

// Substitui o "Unmatched Route" do expo-router (em inglês, com link para
// /_sitemap). Fica na raiz, fora de (auth) e (app), então vale com ou sem
// sessão; "Ir para Convites" passa pela trava de (app)/_layout.tsx, que leva
// ao login quando preciso.
export default function NotFound() {
  return <NotFoundScreen />
}
