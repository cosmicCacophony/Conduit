import { useState } from 'react'

import type { CreatureTemplate, Element } from '../types'

type TeamSelectScreenProps = {
  creatures: CreatureTemplate[]
  onConfirm: (ids: string[]) => void
}

const ELEMENT_SYMBOL: Record<Element, string> = {
  fire: '🔥',
  nature: '🌿',
  water: '💧',
}

const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire',
  nature: 'Nature',
  water: 'Water',
}

export function TeamSelectScreen({ creatures, onConfirm }: TeamSelectScreenProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id)
      }
      if (current.length >= 3) {
        return [...current.slice(1), id]
      }
      return [...current, id]
    })
  }

  const deckPreview = selectedIds
    .map((id) => creatures.find((c) => c.id === id))
    .filter((c): c is CreatureTemplate => c != null)

  const deckElements: Element[] = []
  for (const creature of deckPreview) {
    for (let i = 0; i < creature.cardCount; i++) {
      deckElements.push(creature.element)
    }
  }

  const fireCt = deckElements.filter((e) => e === 'fire').length
  const natureCt = deckElements.filter((e) => e === 'nature').length
  const waterCt = deckElements.filter((e) => e === 'water').length

  return (
    <section className="screen">
      <p className="eyebrow">Assemble your team</p>
      <h2>Choose 3 creatures</h2>
      <p className="screen-copy">
        Each creature adds element cards to your deck. Your team determines what spells you can cast in combat.
      </p>

      <div className="creature-select-grid">
        {creatures.map((creature) => {
          const isSelected = selectedIds.includes(creature.id)
          return (
            <button
              key={creature.id}
              type="button"
              className={`creature-select-card creature-select-card--${creature.element} ${isSelected ? 'is-selected' : ''}`}
              onClick={() => toggleSelection(creature.id)}
            >
              <span className="creature-select-card__emoji">{creature.emoji}</span>
              <strong>{creature.name}</strong>
              <span className="creature-select-card__element">
                {ELEMENT_SYMBOL[creature.element]} {ELEMENT_LABEL[creature.element]}
              </span>
              <span className="muted">+{creature.cardCount} cards</span>
            </button>
          )
        })}
      </div>

      {deckPreview.length > 0 ? (
        <div className="deck-preview">
          <p className="eyebrow">Your Deck ({deckElements.length} cards)</p>
          <div className="deck-breakdown">
            {fireCt > 0 ? <span className="deck-count deck-count--fire">{ELEMENT_SYMBOL.fire} {fireCt}</span> : null}
            {natureCt > 0 ? <span className="deck-count deck-count--nature">{ELEMENT_SYMBOL.nature} {natureCt}</span> : null}
            {waterCt > 0 ? <span className="deck-count deck-count--water">{ELEMENT_SYMBOL.water} {waterCt}</span> : null}
          </div>
        </div>
      ) : null}

      <button
        className="primary-button"
        type="button"
        disabled={selectedIds.length !== 3}
        onClick={() => onConfirm(selectedIds)}
      >
        Begin expedition
      </button>
    </section>
  )
}
