import { useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature, EventDefinition } from '../types'

type EventScreenProps = {
  event: EventDefinition
  creatures: Creature[]
  onResolve: (choiceId: string, creatureId?: string) => void
}

export function EventScreen({ event, creatures, onResolve }: EventScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)

  return (
    <section className="screen">
      <p className="eyebrow">Event</p>
      <h2>{event.title}</h2>
      <p className="screen-copy">{event.text}</p>

      {event.choices.some((choice) => choice.requiresCreature) ? (
        <div className="screen-section">
          <p className="eyebrow">Choose a creature</p>
          <div className="card-grid">
            {creatures.filter((creature) => creature.currentHp > 0).map((creature) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                selected={creature.id === selectedCreatureId}
                onClick={() => setSelectedCreatureId(creature.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="upgrade-grid">
        {event.choices.map((choice) => (
          <button
            key={choice.id}
            className="choice-button"
            type="button"
            disabled={choice.requiresCreature && !selectedCreatureId}
            onClick={() => onResolve(choice.id, selectedCreatureId ?? undefined)}
          >
            <strong>{choice.label}</strong>
            <br />
            <small>{choice.description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
