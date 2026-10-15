export default function Loading() {
  return <div className="tv-cash-page tv-cash-loading" role="status" aria-label="Carregando caixa" aria-busy="true">
    <span className="sr-only">Carregando comandas e recebimentos…</span>
    <div className="tv-cash-loading-navbar" aria-hidden="true"><span className="tv-cash-skeleton-line is-back" /></div>
    <header className="tv-cash-loading-header" aria-hidden="true">
      <span className="tv-cash-skeleton-line is-eyebrow" />
      <span className="tv-cash-skeleton is-title" />
      <span className="tv-cash-skeleton-line is-description" />
    </header>
    <div className="tv-cash-loading-toolbar" aria-hidden="true">
      <span className="tv-cash-skeleton-line is-live" />
      <span className="tv-cash-skeleton is-action" />
      <span className="tv-cash-skeleton is-action" />
    </div>
    <div className="tv-cash-loading-grid" aria-hidden="true">
      <section className="tv-cash-loading-list">
        <span className="tv-cash-skeleton-line tv-cash-loading-list-heading" />
        {[0, 1, 2, 3].map((row) => <div className="tv-cash-loading-row" key={row}>
          <span className="tv-cash-skeleton is-icon" />
          <span className="tv-cash-skeleton-line" />
        </div>)}
        <span className="tv-cash-skeleton-line tv-cash-loading-list-heading" />
        {[0, 1].map((row) => <div className="tv-cash-loading-row" key={`closed-${row}`}>
          <span className="tv-cash-skeleton is-icon" />
          <span className="tv-cash-skeleton-line" />
        </div>)}
      </section>
      <section className="tv-cash-loading-detail">
        <span className="tv-cash-skeleton tv-cash-loading-detail-heading" />
        <div className="tv-cash-loading-receipt">
          <span className="tv-cash-skeleton-line is-receipt-title" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => <span className="tv-cash-skeleton-line is-receipt-line" key={row} />)}
        </div>
        <span className="tv-cash-skeleton tv-cash-loading-payment" />
      </section>
    </div>
  </div>
}
