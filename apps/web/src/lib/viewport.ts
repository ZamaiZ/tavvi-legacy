// Mesmo corte do console-mobile.css e do useIsMobile: abaixo de 768 px os
// detalhes do console abrem como tela empilhada, não como gaveta.
export const MOBILE_QUERY = '(max-width: 767px)'

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
}

// A lista marca a tela empilhada que ela mesma abriu. O "‹ Voltar" só
// desempilha (history.back) quando a marca bate; aberta por link ou depois
// do login, volta para a lista sem sair do app nem cair em /entrar.
const STACK_KEY = 'tv:stacked-from-list'

export function markStackedFromList(path: string) {
  try { sessionStorage.setItem(STACK_KEY, path) } catch { /* janela privada: sem marca, o voltar usa a lista */ }
}

export function openedFromList(path: string) {
  try { return sessionStorage.getItem(STACK_KEY) === path } catch { return false }
}

export function clearStackedFromList() {
  try { sessionStorage.removeItem(STACK_KEY) } catch { /* sem armazenamento, nada a limpar */ }
}
