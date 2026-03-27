import type { Creature, RunStats } from '../types'

type GameOverScreenProps = {
  result: 'victory' | 'defeat'
  roster: Creature[]
  stats: RunStats
  onRestart: () => void
}

export function GameOverScreen({ result, roster, stats, onRestart }: GameOverScreenProps) {
  const title = result === 'victory' ? 'You leave with the tide' : 'The island keeps you'
  const summary =
    result === 'victory'
      ? 'The pull quiets. Your companions remain beside you.'
      : 'The resonance fades. The shore is silent again.'

  return (
    <section className="screen">
      <p className="eyebrow">{result === 'victory' ? 'Run complete' : 'Run lost'}</p>
      <h2>{title}</h2>
      <p className="screen-copy">{summary}</p>

      <div className="summary-grid">
        <div className="summary-card">
          <strong>{stats.fightsWon}</strong>
          <span>Fights won</span>
        </div>
        <div className="summary-card">
          <strong>{stats.boostsGiven}</strong>
          <span>Boosts chosen</span>
        </div>
        <div className="summary-card">
          <strong>{stats.recruited.length}</strong>
          <span>Creatures recruited</span>
        </div>
      </div>

      <div className="summary-list">
        <h3>Final roster</h3>
        <ul>
          {roster.map((creature) => (
            <li key={creature.id}>
              {creature.emoji} {creature.name} - HP {creature.currentHp}/{creature.maxHp}, ATK {creature.attack}
            </li>
          ))}
        </ul>
      </div>

      {stats.recruited.length > 0 ? (
        <p className="screen-copy muted">Recruited this run: {stats.recruited.join(', ')}</p>
      ) : (
        <p className="screen-copy muted">No creature chose to join you this run.</p>
      )}

      <button className="primary-button" type="button" onClick={onRestart}>
        Play again
      </button>
    </section>
  )
}
