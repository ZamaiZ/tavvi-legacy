import '@/features/public-menu/styles/menu.css'

// O layout de `[slug]` busca o cardápio para vestir o tema, e loading.js não
// cobre o layout da própria pasta (doc do Next: loading.md). Por isso este
// esqueleto mora um nível acima. Cores neutras: o tema do restaurante ainda
// não chegou.
export default function Loading() {
  return (
    <div className="menu-loading" aria-busy="true" aria-label="Carregando o cardápio">
      <div className="menu-loading-cover" />
      <div className="menu-loading-body">
        <span className="menu-loading-line is-title" />
        <span className="menu-loading-line" />
        <span className="menu-loading-line is-short" />
        <div className="menu-loading-icons"><span /><span /><span /><span /></div>
      </div>
    </div>
  )
}
