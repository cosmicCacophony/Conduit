import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature, RewardType, SpecialTemplate } from '../types'

type RewardScreenProps = {
  rewardTier: 'normal' | 'elite'
  creatures: Creature[]
  onApply: (creatureId: string, reward: RewardType) => void
  learnOffers: Record<string, SpecialTemplate | null>
}

function getSpecialDescription(special: SpecialTemplate) {
  switch (special.type) {
    case 'strike':
      return `Deal ${special.value} damage`
    case 'guard':
      return `Give an ally ${special.value} shield for the next hit`
    case 'mend':
      return `Heal an ally for ${special.value} HP`
    case 'weaken':
      return `Mark an enemy so the next hit deals +${special.value}`
    case 'rally':
      return `Give an ally +${special.value} attack on their next attack`
    default:
      return `${special.type} ${special.value}`
  }
}

export function RewardScreen({ rewardTier, creatures, onApply, learnOffers }: RewardScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)

  const selectedCreature = useMemo(
    () => creatures.find((creature) => creature.id === selectedCreatureId) ?? null,
    [creatures, selectedCreatureId],
  )

  const learnOffer = selectedCreature ? learnOffers[selectedCreature.id] : null
  const canLearn = Boolean(learnOffer && selectedCreature && selectedCreature.specials.length < 2)
  const showUpgrade = Boolean(selectedCreature && selectedCreature.specials.length > 0)

  return (
    <section className="screen">
      <p className="eyebrow">{rewardTier === 'elite' ? 'Elite reward' : 'After the fight'}</p>
      <h2>{rewardTier === 'elite' ? 'Claim a deeper edge' : 'Deepen the bond'}</h2>
      <p className="screen-copy">
        Pick a creature first. Then choose a reward that shapes how it will carry the rest of the run.
      </p>

      <div className="card-grid">
        {creatures.map((creature) => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            selected={creature.id === selectedCreatureId}
            showLockedSpecials
            onClick={() => setSelectedCreatureId(creature.id)}
          />
        ))}
      </div>

      {selectedCreature ? (
        <div className="reward-panel">
          <div className="choice-row">
            <button className="choice-button" type="button" onClick={() => onApply(selectedCreature.id, { type: 'hp' })}>
              +2 Max HP and heal 2
            </button>
            <button className="choice-button" type="button" onClick={() => onApply(selectedCreature.id, { type: 'atk' })}>
              +1 Attack
            </button>
            {canLearn ? (
              <button
                className="choice-button"
                type="button"
                onClick={() =>
                  onApply(selectedCreature.id, { type: 'learn', specialId: learnOffer!.id })
                }
              >
                Learn {learnOffer?.name}
                <br />
                <small>{learnOffer ? getSpecialDescription(learnOffer) : ''}</small>
                <br />
                <small>Cooldown {learnOffer?.cooldown}</small>
              </button>
            ) : null}
          </div>

          {showUpgrade ? (
            <div className="upgrade-grid">
              {selectedCreature.specials.map((special) => (
                <div key={special.id} className="upgrade-card">
                  <strong>{special.name}</strong>
                  <span>{getSpecialDescription(special)}</span>
                  <span>Value {special.value}</span>
                  <span>Cooldown {special.cooldown}</span>
                  <div className="choice-row">
                    <button
                      className="choice-button"
                      type="button"
                      onClick={() => onApply(selectedCreature.id, { type: 'upgradeValue', specialId: special.id })}
                    >
                      +2 value
                    </button>
                    <button
                      className="choice-button"
                      type="button"
                      onClick={() =>
                        onApply(selectedCreature.id, { type: 'upgradeCooldown', specialId: special.id })
                      }
                    >
                      -1 cooldown
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
