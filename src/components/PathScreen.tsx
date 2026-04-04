import { getElementLabel } from '../hooks/useGameState'
import type { EncounterDefinition } from '../types'

type PathScreenProps = {
  layerIndex: number
  options: EncounterDefinition[]
  onChoose: (encounterId: string) => void
}

export function PathScreen({ layerIndex, options, onChoose }: PathScreenProps) {
  return (
    <section className="screen">
      <p className="eyebrow">Path {layerIndex + 1}</p>
      <h2>Choose your next step</h2>
      <p className="screen-copy">
        This is where the run starts to split. Pick the kind of pressure, recovery, or opportunity you want next.
      </p>
      <div className="upgrade-grid">
        {options.map((option) => (
          <button key={option.id} className="choice-button" type="button" onClick={() => onChoose(option.id)}>
            <strong>{option.type}</strong>
            <br />
            {option.type === 'fight' && option.previewEnemyName ? (
              <>
                <small>
                  Known threat: {option.previewEnemyName} ({getElementLabel(option.previewEnemyElement!).toLowerCase()})
                </small>
                <br />
              </>
            ) : null}
            {(option.type === 'elite' || option.type === 'boss') && !option.previewEnemyName ? (
              <>
                <small>Known threat: ???</small>
                <br />
              </>
            ) : null}
            <small>{option.text}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
