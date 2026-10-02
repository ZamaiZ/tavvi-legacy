// Esqueleto da página de lista no formato do console: cabeçalho, estatísticas,
// toolbar e tabela. No celular, console-mobile.css reduz ao título e à lista.
export function ConsoleListSkeleton() {
  return <main className="tv-console-page tv-loading-page" aria-busy="true" aria-label="Carregando">
    <div className="tv-skeleton tv-skeleton-m-title tv-m-only" aria-hidden="true" />
    <div className="tv-skeleton-head tv-d-only" aria-hidden="true">
      <span className="tv-skeleton tv-skeleton-title" />
      <span className="tv-skeleton tv-skeleton-text" />
    </div>
    <div className="tv-skeleton-stats" aria-hidden="true">
      <span className="tv-skeleton tv-skeleton-hero" />
      <span className="tv-skeleton tv-skeleton-stat" />
      <span className="tv-skeleton tv-skeleton-stat" />
      <span className="tv-skeleton tv-skeleton-stat" />
    </div>
    <div className="tv-skeleton tv-skeleton-toolbar" aria-hidden="true" />
    <div className="tv-skeleton-list" aria-hidden="true">
      <span className="tv-skeleton-list-head" />
      {Array.from({ length: 5 }, (_, i) => <div className="tv-skeleton-row" key={i}>
        <span className="tv-skeleton tv-skeleton-row-tile" />
        <span className="tv-skeleton tv-skeleton-row-line" />
      </div>)}
    </div>
  </main>
}
