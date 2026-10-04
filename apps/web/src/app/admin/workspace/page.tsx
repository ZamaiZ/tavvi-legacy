import { redirect } from 'next/navigation'

// `/` deixa de servir conteúdo no painel, e isso é estrutural, não estético.
//
// Era o ÚNICO caminho que o território público e o painel dividiam: o proxy
// separa os dois pelo header Host, mas toda camada de cache do Next — o cache
// do roteador no cliente, o cache de rota cheia no servidor, e uma CDN em
// produção — chaveia por CAMINHO, não por host. Enquanto os dois dividirem
// `/`, existe um jeito de a árvore do site ser servida dentro do painel, que
// é exatamente o sintoma relatado: a página "Aproxime o celular do identificador"
// aparecendo depois de entrar ou de salvar.
//
// Com o desvio, o painel nunca renderiza em `/`, e a ambiguidade acaba.
export default function Page() {
  redirect('/restaurantes')
}
