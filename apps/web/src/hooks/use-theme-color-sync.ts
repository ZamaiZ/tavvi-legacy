'use client'

import { useEffect } from 'react'

// Barra do navegador na cor do fundo da tela, inclusive quando o tema
// escolhido difere do tema do sistema. No app instalado (PWA), é também a
// barra de título do desktop e a barra de status do Android.
//
// Só troca o conteúdo das <meta name="theme-color"> que o `viewport` da
// rota já declarou: sem elas, o navegador usaria o theme_color do manifesto.
export function useThemeColorSync(light: string, dark: string) {
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      const color = root.classList.contains('dark') ? dark : light
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => { meta.content = color })
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [light, dark])
}
