import { useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature } from '../types'

type RecruitScreenProps = {
  encounterText: string
  creatures: Creature[]
  onRecruit: (creatureId: string) => void
  onSkip: () => void
}

export function RecruitScreen({
  encounterText,
  creatures,
  onRecruit,
  onSkip,
}: RecruitScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)

  return (
    <section className="screen">
      <p className="eyebrow">Recruitment</p>
      <h2>The island offers a choice</h2>
      <p className="screen-copy">{encounterText}</p>
      <p className="screen-copy muted">The voice returns: "They do not belong to you. They choose to remain."</p>
      <p className="screen-copy muted">Recruiting restores 3 HP to each living creature in your roster.</p>

      <div className="card-grid">
        {creatures.map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            selected={creature.id === selectedCreatureId}
            onClick={() => setSelectedCreatureId(creature.id)}
          />
        ))}
      </div>

      <div className="choice-row">
        <button
          className="primary-button"
          type="button"
          disabled={!selectedCreatureId}
          onClick={() => {
            if (selectedCreatureId) {
              onRecruit(selectedCreatureId)
            }
          }}
        >
          Recruit
        </button>
        <button className="secondary-button" type="button" onClick={onSkip}>
          Keep moving
        </button>
      </div>
    </section>
  )
}
