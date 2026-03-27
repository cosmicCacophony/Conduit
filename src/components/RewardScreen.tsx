import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature, RewardType } from '../types'

type RewardScreenProps = {
  creatures: Creature[]
  onApply: (creatureId: string, reward: RewardType) => void
}

export function RewardScreen({ creatures, onApply }: RewardScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)
  const [reward, setReward] = useState<RewardType>('hp')

  const selectedCreature = useMemo(
    () => creatures.find((creature) => creature.id === selectedCreatureId) ?? null,
    [creatures, selectedCreatureId],
  )

  return (
    <section className="screen">
      <p className="eyebrow">After the fight</p>
      <h2>Deepen the bond</h2>
      <p className="screen-copy">
        Pick one creature from the battle pair and give it a small edge.
      </p>

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
          className={reward === 'hp' ? 'choice-button is-selected' : 'choice-button'}
          type="button"
          onClick={() => setReward('hp')}
        >
          +2 Max HP and heal 2
        </button>
        <button
          className={reward === 'atk' ? 'choice-button is-selected' : 'choice-button'}
          type="button"
          onClick={() => setReward('atk')}
        >
          +1 Attack
        </button>
      </div>

      <button
        className="primary-button"
        type="button"
        disabled={!selectedCreature}
        onClick={() => {
          if (selectedCreature) {
            onApply(selectedCreature.id, reward)
          }
        }}
      >
        Continue
      </button>
    </section>
  )
}
