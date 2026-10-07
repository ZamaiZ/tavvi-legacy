import Script from 'next/script'

// Este script roda ANTES da primeira pintura. E ele que evita o lampejo
// branco quando a preferencia e escura: sem isso, a pagina pinta clara e so
// depois o React corrige, o que aparece como um flash na cara do usuario.
//
// Precisa ser sincrono e embutido. Um componente React normal nao serve,
// porque so executaria depois da hidratacao -- tarde demais.
//
// O try/catch nao e decorativo: em janela privada o acesso ao localStorage
// LANCA, e sem ele a pagina inteira quebraria antes de pintar qualquer coisa.
const script = `(function(){var t="system",m="system";try{var s=localStorage.getItem("tema");if(s==="light"||s==="dark"||s==="system")t=s;var p=localStorage.getItem("tema-cardapio");if(p==="light"||p==="dark"||p==="system")m=p;}catch(e){}var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";document.documentElement.dataset.menuAppearance=m;})()`

export function ThemeScript() {
  // Um dos dois dangerouslySetInnerHTML do projeto (o outro e o
  // PwaInstallCapture). Os dois sao seguros porque o conteudo e uma
  // constante escrita por nos, sem nenhuma entrada de usuario.
  return (
    <Script
      id="theme-prepaint"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  )
}
