export default function Loading() {
  return <main className="tv-finance-page tv-finance-loading" aria-busy="true" aria-label="Carregando o Financeiro">
    <div className="tv-finance-loading-heading"><span /><span /><span /></div>
    <div className="tv-finance-loading-metrics">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
    <div className="tv-finance-loading-panel"><span /><span /><span /></div>
    <div className="tv-finance-loading-panel"><span /><span /><span /></div>
  </main>
}
