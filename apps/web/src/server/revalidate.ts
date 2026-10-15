import 'server-only'
import { revalidatePath } from 'next/cache'

export type RevalidationTarget = { id: string; slug: string }

// O proxy reescreve `/` para `/painel` e `/x` para `/painel/x`. A doc
// empacotada do Next é explícita sobre o que isso exige
// (`01-app/03-api-reference/04-functions/revalidatePath.md`, linha 57):
//
//   "When using rewrites, you must pass the DESTINATION path (the actual
//    route file location), not the source path that appears in the
//    browser's address bar."
//
// Até a Fase 4 havia trinta e seis chamadas de `revalidatePath('/')` — o
// caminho de ORIGEM. Nenhuma delas revalidava `/painel/**` nem `/[slug]`; a
// única rota que elas invalidavam era `app/(site)/page.tsx`, a página que diz
// para encostar o celular no identificador. O sintoma era o painel não atualizar
// depois de salvar, e o cardápio público envelhecer depois de publicar.
//
// Esta é a ÚNICA exceção à regra "rotas são externas" que vale no projeto.
// Em `href` e em `redirect` continua sendo `/restaurantes/x`.
export function revalidateRestaurant({ id, slug }: RevalidationTarget): void {
  // O território público não tem rewrite, então o cardápio entra pelo
  // caminho literal — e caminho literal não leva `type`.
  revalidatePath(`/${slug}`)
  revalidatePath(`/admin/workspace/restaurants/${id}`, 'layout')
  revalidatePath(`/admin/restaurants/${id}`)
}

// Item/category changes affect the public menu and its editor page. They do
// not change the restaurant shell or platform-admin summary, so avoid
// invalidating either layout for these frequent writes.
export function revalidateMenu({ id, slug }: RevalidationTarget): void {
  revalidatePath(`/${slug}`)
  revalidatePath(`/admin/workspace/restaurants/${id}`)
}

// Só o caminho público. Existe para um caso: quando a plataforma troca o
// endereço, o slug ANTIGO também precisa ser invalidado, senão ele continua
// servindo o cardápio de um endereço que já não existe.
export function revalidatePublicPath(slug: string): void {
  revalidatePath(`/${slug}`)
}

// Para a escrita que muda a LISTA, e não um restaurante: criar, remover,
// trocar a situação pela plataforma, emitir ou revogar convite.
//
// Varre os dois territórios inteiros de propósito. Uma varrida mais fina
// exigiria saber em qual página cada lista mora, e essa é uma informação que
// muda quando alguém move uma tela — o tipo de acoplamento que produz cache
// velho meses depois, sem ninguém relacionar as duas coisas. Escrita que
// mexe em lista é rara; varrer demais aqui não custa nada.
export function revalidateLists(): void {
  revalidatePath('/admin/workspace', 'layout')
  revalidatePath('/admin/(platform)', 'layout')
}
