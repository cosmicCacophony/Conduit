import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature } from '../types'

type TeamSelectScreenProps = {
  creatures: Creature[]
  encounterIndex: number
  encounterText: string
  onConfirm: (ids: string[]) => void
}

export function TeamSelectScreen({
  creatures,
  encounterIndex,
  encounterText,
  onConfirm,
}: TeamSelectScreenProps) {
  const requiredCount = Math.min(2, creatures.length)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const helperText = useMemo(() => {
    if (requiredCount === 1) {
      return 'Only one creature can still answer. Bring it.'
    }

    return 'Choose two creatures to carry the next fight.'
  }, [requiredCount])

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id)
      }

      if (current.length >= requiredCount) {
        return [...current.slice(1), id]
      }

      return [...current, id]
    })
  }

  return (
    <section className="screen">
      <p className="eyebrow">Encounter {encounterIndex + 1}</p>
      <h2>Attune your pair</h2>
      <p className="screen-copy">{encounterText}</p>
      <p className="screen-copy muted">{helperText}</p>

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

      <button
        className="primary-button"
        type="button"
        disabled={selectedIds.length !== requiredCount}
        onClick={() => onConfirm(selectedIds)}
      >
        Enter battle
      </button>
    </section>
  )
}
