// Endereço público do cardápio no domínio raiz, com o protocolo da página
// atual (http no desenvolvimento, https em produção). Só no cliente, como o
// "Copiar" do detalhe do restaurante.
export function publicMenuUrl(rootDomain: string, slug: string) {
  return `${window.location.protocol}//${rootDomain.replace(/^https?:\/\//, '')}/${slug}`
}
