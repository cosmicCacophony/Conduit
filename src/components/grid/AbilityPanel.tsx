import type { GridCharacter, SelectedAction } from '../../grid/types'

type AbilityPanelProps = {
  actor: GridCharacter | null
  selectedAction: SelectedAction | null
  canMove: boolean
  isMoving: boolean
  onMove: () => void
  onCancelMove: () => void
  onSelectAbility: (abilityId: string) => void
  onCancelAbility: () => void
  onEndTurn: () => void
}

export function AbilityPanel({
  actor,
  selectedAction,
  canMove,
  isMoving,
  onMove,
  onCancelMove,
  onSelectAbility,
  onCancelAbility,
  onEndTurn,
}: AbilityPanelProps) {
  if (!actor) {
    return (
      <div className="ability-panel ability-panel--empty">
        <p className="muted">No active character.</p>
      </div>
    )
  }

  return (
    <div className="ability-panel">
      <div className="ability-panel__header">
        <span className="ability-panel__emoji">{actor.emoji}</span>
        <div>
          <strong>{actor.name}</strong>
          <div className="ability-panel__mana">Mana: {actor.mana}</div>
        </div>
      </div>
      <div className="ability-panel__actions">
        {actor.hasMoved ? (
          <button type="button" disabled className="secondary-button">
            Moved
          </button>
        ) : isMoving ? (
          <button type="button" className="secondary-button" onClick={onCancelMove}>
            Cancel Move
          </button>
        ) : (
          <button type="button" className="secondary-button" onClick={onMove} disabled={!canMove}>
            Move (free)
          </button>
        )}

        {actor.abilities.map((ability) => {
          const cantAfford = actor.mana < ability.manaCost
          const acted = actor.hasActed
          const isSelected = selectedAction?.abilityId === ability.id
          return (
            <button
              key={ability.id}
              type="button"
              className={[
                'secondary-button',
                'ability-button',
                isSelected ? 'ability-button--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => (isSelected ? onCancelAbility() : onSelectAbility(ability.id))}
              disabled={cantAfford || acted}
              title={ability.description}
            >
              <strong>{ability.name}</strong>
              <span className="ability-button__cost">{ability.manaCost} mana</span>
              <span className="ability-button__desc">{ability.description}</span>
            </button>
          )
        })}

        <button type="button" className="primary-button" onClick={onEndTurn}>
          End Turn
        </button>
      </div>
    </div>
  )
}
