export default function Loading() {
  return <main className="tv-finance-page tv-finance-loading" aria-busy="true" aria-label="Carregando o Financeiro">
    <div className="tv-finance-loading-heading"><span /><span /><span /></div>
    <div className="tv-finance-loading-status" aria-hidden="true">
      <span />
      <div className="tv-finance-loading-status-copy"><span /><span /></div>
      <span />
    </div>
    <div className="tv-finance-loading-tabs" aria-hidden="true"><span /><span /><span /></div>
    <div className="tv-finance-loading-panel" aria-hidden="true">
      <span /><span />
      <div className="tv-finance-loading-panel-grid"><span /><span /></div>
    </div>
  </main>
}
