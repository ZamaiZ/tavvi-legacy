export default function Loading() {
  return <main className="tv-loading-page"><div className="tv-skeleton tv-skeleton-hero" /><div className="tv-skeleton tv-skeleton-toolbar" /><div className="tv-skeleton-list">{Array.from({ length: 5 }, (_, i) => <div className="tv-skeleton tv-skeleton-row" key={i} />)}</div></main>
}
