import type { CreatureTemplate, RunStats } from '../types'

type GameOverScreenProps = {
  result: 'victory' | 'defeat'
  team: CreatureTemplate[]
  stats: RunStats
  encounterIndex: number
  totalEncounters: number
  onRestart: () => void
}

export function GameOverScreen({ result, team, stats, encounterIndex, totalEncounters, onRestart }: GameOverScreenProps) {
  const title = result === 'victory' ? 'You leave with the tide' : 'The island keeps you'
  const summary =
    result === 'victory'
      ? 'The pull quiets. Whatever crossed with you chose to stay.'
      : 'The resonance dims. The island keeps what is not yet ready to cross.'

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
          <strong>{encounterIndex + 1}/{totalEncounters}</strong>
          <span>Progress</span>
        </div>
      </div>

      <div className="summary-list">
        <h3>Your team</h3>
        <ul>
          {team.map((creature) => (
            <li key={creature.id}>
              {creature.emoji} {creature.name}
            </li>
          ))}
        </ul>
      </div>

      <button className="primary-button" type="button" onClick={onRestart}>
        Play again
      </button>
    </section>
  )
}
