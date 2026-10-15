export default function Loading() {
  return (
    <div className="tv-calls-page tv-calls-loading" aria-busy="true">
      <span className="sr-only" role="status">Carregando chamados.</span>
      <div className="tv-calls-loading-content" aria-hidden="true">
        <div className="tv-calls-loading-navbar">
          <span className="tv-calls-skeleton-line is-back" />
        </div>

        <header className="tv-calls-loading-header">
          <span className="tv-calls-skeleton-line is-eyebrow" />
          <span className="tv-calls-skeleton-line is-title" />
          <span className="tv-calls-skeleton-line is-description" />
        </header>

        <div className="tv-calls-summary">
          {['pending', 'in_progress', 'resolved'].map((status) => (
            <div className={`tv-call-summary-card is-${status}${status === 'pending' ? ' is-active' : ''} tv-calls-loading-summary`} key={status}>
              <span className="tv-call-summary-icon tv-calls-skeleton-block" />
              <span className="tv-call-summary-copy">
                <span className="tv-calls-skeleton-line is-summary-label" />
                <span className="tv-calls-skeleton-line is-summary-value" />
              </span>
              <span className="tv-call-summary-arrow">
                <span className="tv-calls-skeleton-block is-summary-arrow" />
              </span>
            </div>
          ))}
        </div>

        <div className="tv-calls-toolbar">
          <div className="tv-calls-tools">
            <span className="tv-calls-live"><i /><span className="tv-calls-skeleton-line is-live-label" /></span>
            <span className="tv-calls-sound"><span className="tv-calls-skeleton-block is-sound-icon" /><span className="tv-calls-skeleton-line is-sound-label" /></span>
          </div>
        </div>

        <div className="tv-calls-layout">
          <section className="tv-calls-list-panel">
            <div className="tv-calls-list-head">
              <div>
                <span className="tv-calls-skeleton-line is-list-heading" />
                <span className="tv-calls-skeleton-line is-list-caption" />
              </div>
              <span className="tv-calls-skeleton-line is-list-count" />
            </div>
            <ul className="tv-calls-list">
              {Array.from({ length: 4 }, (_, index) => (
                <li key={index}>
                  <div className="tv-call-row tv-calls-loading-row">
                    <span className="tv-call-row-icon tv-calls-skeleton-block" />
                    <span className="tv-call-row-copy">
                      <span className="tv-call-row-topline">
                        <span className="tv-calls-skeleton-line is-table-number" />
                        <span className="tv-calls-skeleton-pill" />
                      </span>
                      <span className="tv-calls-skeleton-line is-row-detail" />
                      <span className="tv-calls-skeleton-line is-row-assignee" />
                    </span>
                    <span className="tv-calls-skeleton-line is-row-time" />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="tv-call-detail">
            <div className="tv-call-detail-topline">
              <span className="tv-call-state tv-calls-skeleton-pill" />
              <span className="tv-calls-skeleton-line is-reference" />
            </div>
            <div className="tv-call-table-heading">
              <span className="tv-call-table-icon tv-calls-skeleton-block" />
              <div>
                <span className="tv-calls-skeleton-line is-table-caption" />
                <span className="tv-calls-skeleton-line is-table-title" />
              </div>
            </div>
            <div className="tv-call-detail-time">
              <span className="tv-calls-skeleton-block is-time-icon" />
              <span className="tv-calls-skeleton-line is-detail-time" />
            </div>
            <div className="tv-call-timing-card">
              <span className="tv-call-timing-icon tv-calls-skeleton-block" />
              <div>
                <span className="tv-calls-skeleton-line is-timing-label" />
                <span className="tv-calls-skeleton-line is-timing-value" />
                <span className="tv-calls-skeleton-line is-timing-note" />
              </div>
            </div>
            <div className="tv-call-assignment-card">
              <span className="tv-call-assignment-icon tv-calls-skeleton-block" />
              <div>
                <span className="tv-calls-skeleton-line is-assignment-label" />
                <span className="tv-calls-skeleton-line is-assignment-name" />
                <span className="tv-calls-skeleton-line is-assignment-note" />
              </div>
            </div>
            <div className="tv-call-action-area">
              <span className="tv-call-button is-primary is-wide tv-calls-loading-action">
                <span className="tv-calls-skeleton-line is-action-label" />
              </span>
            </div>
            <div className="tv-call-history">
              <div className="tv-call-history-heading">
                <span className="tv-calls-skeleton-block is-history-icon" />
                <span className="tv-calls-skeleton-line is-history-title" />
              </div>
              <ol>
                {Array.from({ length: 2 }, (_, index) => (
                  <li key={index}>
                    <span className="tv-call-history-dot" />
                    <div>
                      <span className="tv-calls-skeleton-line is-history-event" />
                      <span className="tv-calls-skeleton-line is-history-actor" />
                    </div>
                    <span className="tv-calls-skeleton-line is-history-time" />
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
