type TitleScreenProps = {
  onStart: () => void
  summary: {
    runs: number
    wins: number
    bestStreak: number
  }
}

export function TitleScreen({ onStart, summary }: TitleScreenProps) {
  return (
    <section className="screen screen--title">
      <p className="eyebrow">A quiet island. A strange pull.</p>
      <h1>Conduit</h1>
      <p className="lede">
        You wake on a silent shore. Creatures gather close, as though they have been
        waiting for you.
      </p>
      <p className="screen-copy muted">A voice beneath the surf: "You are not the first to wake here."</p>
      <div className="summary-grid title-summary">
        <div className="summary-card">
          <strong>{summary.runs}</strong>
          <span>Runs</span>
        </div>
        <div className="summary-card">
          <strong>{summary.wins}</strong>
          <span>Wins</span>
        </div>
        <div className="summary-card">
          <strong>{summary.bestStreak}</strong>
          <span>Best streak</span>
        </div>
      </div>
      <button className="primary-button" type="button" onClick={onStart}>
        Begin
      </button>
    </section>
  )
}
