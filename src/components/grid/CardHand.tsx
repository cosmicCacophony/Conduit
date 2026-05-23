import { ELEMENT_ICONS, ELEMENT_LABELS } from '../../grid/constants'
import type { BattleState, Card } from '../../grid/types'

type CardHandProps = {
  state: BattleState
  selectedCardId: string | null
  onSelectCard: (cardId: string) => void
}

export function CardHand({ state, selectedCardId, onSelectCard }: CardHandProps) {
  const assignedCardIds = new Set(Object.values(state.assignments))
  return (
    <div className="card-hand">
      {state.hand.map((card) => {
        const assigned = assignedCardIds.has(card.id)
        const assignedTo = Object.entries(state.assignments).find(([, cId]) => cId === card.id)?.[0]
        const character = assignedTo
          ? state.playerChars.find((c) => c.id === assignedTo)
          : null
        return (
          <button
            key={card.id}
            type="button"
            className={[
              'drift-card',
              `drift-card--${card.element}`,
              selectedCardId === card.id ? 'drift-card--selected' : '',
              assigned ? 'drift-card--assigned' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelectCard(card.id)}
          >
            <span className="drift-card__value">{card.value}</span>
            <span className="drift-card__icon">{ELEMENT_ICONS[card.element]}</span>
            <span className="drift-card__element">{ELEMENT_LABELS[card.element]}</span>
            {character ? (
              <span className="drift-card__assigned-to">{character.emoji}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export type { Card }
