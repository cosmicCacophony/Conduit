import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature } from '../types'

type TeamSelectScreenProps = {
  creatures: Creature[]
  fullRoster: Creature[]
  encounterIndex: number
  encounterText: string
  onConfirm: (ids: string[]) => void
}

export function TeamSelectScreen({
  creatures,
  fullRoster,
  encounterIndex,
  encounterText,
  onConfirm,
}: TeamSelectScreenProps) {
  const minCount = Math.min(3, creatures.length)
  const maxCount = Math.min(4, creatures.length)
  const [selectedIds, setSelectedIds] = useState<string[]>(creatures.slice(0, minCount).map((creature) => creature.id))
  const fallenCreatures = useMemo(
    () => fullRoster.filter((creature) => creature.currentHp <= 0),
    [fullRoster],
  )

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        if (current.length <= minCount) {
          return current
        }

        return current.filter((entry) => entry !== id)
      }

      if (current.length >= maxCount) {
        return [...current.slice(1), id]
      }

      return [...current, id]
    })
  }

  return (
    <section className="screen">
      <p className="eyebrow">Encounter {encounterIndex + 1}</p>
      <h2>Choose your roster</h2>
      <p className="screen-copy">{encounterText}</p>
      <p className="screen-copy muted">
        Bring {minCount === maxCount ? minCount : `${minCount}-${maxCount}`} living creatures. The first selected will start active.
      </p>

      <div className="screen-section">
        <p className="eyebrow">Available</p>
        <div className="card-grid">
          {creatures.map((creature) => (
            <CreatureCard
              key={creature.id}
              creature={creature}
              selected={selectedIds.includes(creature.id)}
              onClick={() => toggleSelection(creature.id)}
            />
          ))}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="summary-list">
          <h3>Starting Order</h3>
          <ul>
            {selectedIds.map((id, index) => {
              const creature = creatures.find((entry) => entry.id === id)
              return <li key={id}>{index === 0 ? `Lead: ${creature?.name ?? id}` : creature?.name ?? id}</li>
            })}
          </ul>
        </div>
      ) : null}

      {fallenCreatures.length > 0 ? (
        <div className="screen-section">
          <p className="eyebrow">Fallen This Run</p>
          <div className="card-grid">
            {fallenCreatures.map((creature) => (
              <CreatureCard key={creature.id} creature={creature} disabled compact />
            ))}
          </div>
        </div>
      ) : null}

      <button
        className="primary-button"
        type="button"
        disabled={selectedIds.length < minCount || selectedIds.length > maxCount}
        onClick={() => onConfirm(selectedIds)}
      >
        Enter battle
      </button>
    </section>
  )
}
