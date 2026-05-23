import { ELEMENT_LABELS } from '../../grid/constants'
import type { BattleState, GridCharacter } from '../../grid/types'

type CharacterRosterProps = {
  state: BattleState
  selectedCardId: string | null
  onClickCharacter: (character: GridCharacter) => void
  selectedActorId: string | null
}

export function CharacterRoster({
  state,
  selectedCardId,
  onClickCharacter,
  selectedActorId,
}: CharacterRosterProps) {
  const cardById = new Map(state.hand.map((c) => [c.id, c]))

  return (
    <div className="roster">
      <h3 className="roster__title">Allies</h3>
      <div className="roster__list">
        {state.playerChars.map((character) => {
          const cardId = state.assignments[character.id]
          const card = cardId ? cardById.get(cardId) : null
          const dead = character.currentHp <= 0
          const isSelected = selectedActorId === character.id
          const canReceiveCard =
            state.phase === 'assign' && !dead && selectedCardId !== null
          return (
            <button
              key={character.id}
              type="button"
              className={[
                'roster__character',
                `roster__character--${character.element}`,
                dead ? 'roster__character--dead' : '',
                isSelected ? 'roster__character--active' : '',
                canReceiveCard ? 'roster__character--receivable' : '',
                state.currentActorId === character.id ? 'roster__character--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onClickCharacter(character)}
              disabled={dead}
            >
              <div className="roster__character-head">
                <span className="roster__character-emoji">{character.emoji}</span>
                <div>
                  <div className="roster__character-name">{character.name}</div>
                  <div className="roster__character-element">
                    {ELEMENT_LABELS[character.element]}
                  </div>
                </div>
              </div>
              <div className="roster__hp-track">
                <div
                  className="roster__hp-fill"
                  style={{
                    width: `${Math.max(0, (character.currentHp / character.maxHp) * 100)}%`,
                  }}
                />
              </div>
              <div className="roster__stats">
                <span>HP {character.currentHp}/{character.maxHp}</span>
                {state.phase !== 'assign' && state.currentActorId === character.id ? (
                  <span>Mana {character.mana}</span>
                ) : null}
                {card ? (
                  <span className="roster__card-tag">
                    {card.value} {card.element}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      <h3 className="roster__title">Enemies</h3>
      <div className="roster__list">
        {state.enemyChars.map((character) => {
          const dead = character.currentHp <= 0
          return (
            <div
              key={character.id}
              className={[
                'roster__character',
                'roster__character--enemy',
                `roster__character--${character.element}`,
                dead ? 'roster__character--dead' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="roster__character-head">
                <span className="roster__character-emoji">{character.emoji}</span>
                <div>
                  <div className="roster__character-name">{character.name}</div>
                  <div className="roster__character-element">
                    {ELEMENT_LABELS[character.element]}
                  </div>
                </div>
              </div>
              <div className="roster__hp-track">
                <div
                  className="roster__hp-fill roster__hp-fill--enemy"
                  style={{
                    width: `${Math.max(0, (character.currentHp / character.maxHp) * 100)}%`,
                  }}
                />
              </div>
              <div className="roster__stats">
                <span>HP {character.currentHp}/{character.maxHp}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
