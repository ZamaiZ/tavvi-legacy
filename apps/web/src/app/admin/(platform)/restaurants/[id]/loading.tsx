export default function Loading() {
  return <main className="tv-detail-page" aria-busy="true" aria-label="Carregando restaurante">
    <div className="tv-skeleton tv-skeleton-m-nav tv-m-only" aria-hidden="true" />
    <div className="tv-detail-page-content">
      <header><span className="tv-skeleton tv-skeleton-detail-eyebrow" /><div className="tv-skeleton tv-skeleton-detail-title" /></header>
      <div className="tv-detail-stack" aria-hidden="true">
        <div className="tv-skeleton tv-skeleton-detail-hero" />
        <div className="tv-skeleton tv-skeleton-detail-block" />
        <div className="tv-skeleton tv-skeleton-detail-block is-tall" />
        <div className="tv-skeleton tv-skeleton-detail-info" />
      </div>
    </div>
  </main>
}
