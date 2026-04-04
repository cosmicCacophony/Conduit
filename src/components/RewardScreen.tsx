import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature, RewardType, SpecialTemplate } from '../types'
import { getElementLabel } from '../hooks/useGameState'

type RewardScreenProps = {
  rewardTier: 'normal' | 'elite'
  creatures: Creature[]
  onApply: (creatureId: string, reward: RewardType) => void
  learnOffers: SpecialTemplate[]
}

function getSpecialDescription(special: SpecialTemplate) {
  switch (special.type) {
    case 'strike':
      return `Deal ${special.value} typed damage`
    case 'guard':
      return `Give an ally ${special.value} shield for the next hit`
    case 'mend':
      return `Heal an ally for ${special.value} HP`
    case 'weaken':
      return `Mark an enemy so the next hit deals +${special.value}`
    case 'rally':
      return `Give an ally +${special.value} attack on their next attack`
    case 'poison':
      return `Poison an enemy for ${special.value} each turn`
    case 'taunt':
      return `Force attacks into this target for ${special.value} turn${special.value === 1 ? '' : 's'}`
    default:
      return `${special.type} ${special.value}`
  }
}

export function RewardScreen({ rewardTier, creatures, onApply, learnOffers }: RewardScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)
  const [selectedLearnId, setSelectedLearnId] = useState<string | null>(learnOffers[0]?.id ?? null)

  const selectedCreature = useMemo(
    () => creatures.find((creature) => creature.id === selectedCreatureId) ?? null,
    [creatures, selectedCreatureId],
  )

  const selectedLearn = useMemo(
    () => learnOffers.find((offer) => offer.id === selectedLearnId) ?? null,
    [learnOffers, selectedLearnId],
  )
  const eligibleLearners = useMemo(
    () =>
      selectedLearn
        ? creatures.filter(
            (creature) =>
              creature.specials.length < 2 &&
              creature.specials.every((special) => special.id !== selectedLearn.id),
          )
        : [],
    [creatures, selectedLearn],
  )
  const showUpgrade = Boolean(selectedCreature && selectedCreature.specials.length > 0)

  return (
    <section className="screen">
      <p className="eyebrow">{rewardTier === 'elite' ? 'Elite reward' : 'After the fight'}</p>
      <h2>{rewardTier === 'elite' ? 'Claim a deeper edge' : 'Deepen the bond'}</h2>
      <p className="screen-copy">
        Pick a creature to grow directly, or draft one shared special and decide who should learn it.
      </p>
      <p className="screen-copy muted">
        {rewardTier === 'elite'
          ? 'The current tightens: "Some lessons are only given under pressure."'
          : 'Something in the island listens back as the bond deepens.'}
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
              Hold on
              <br />
              <small>+2 Max HP and heal 2</small>
            </button>
            <button className="choice-button" type="button" onClick={() => onApply(selectedCreature.id, { type: 'atk' })}>
              Press forward
              <br />
              <small>+1 Attack</small>
            </button>
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
                      Strengthen
                      <br />
                      <small>+2 value</small>
                    </button>
                    <button
                      className="choice-button"
                      type="button"
                      onClick={() =>
                        onApply(selectedCreature.id, { type: 'upgradeCooldown', specialId: special.id })
                      }
                    >
                      Refine
                      <br />
                      <small>-1 cooldown</small>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {learnOffers.length > 0 ? (
            <div className="screen-section">
              <p className="eyebrow">Shared draft</p>
              <p className="screen-copy muted">
                Pick one special, then decide which creature should carry that coverage.
              </p>
              <div className="upgrade-grid">
                {learnOffers.map((offer) => (
                  <button
                    key={offer.id}
                    className={`choice-button ${offer.id === selectedLearnId ? 'is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedLearnId(offer.id)}
                  >
                    <strong>{offer.name}</strong>
                    <br />
                    <small>
                      {[offer.element ? getElementLabel(offer.element) : null, offer.type].filter(Boolean).join(' · ')}
                    </small>
                    <br />
                    <small>{getSpecialDescription(offer)}</small>
                    <br />
                    <small>Cooldown {offer.cooldown}{offer.chargeTurns ? ` · Charge ${offer.chargeTurns}` : ''}</small>
                  </button>
                ))}
              </div>

              {selectedLearn ? (
                <div className="upgrade-grid">
                  {eligibleLearners.length > 0 ? (
                    eligibleLearners.map((creature) => (
                      <button
                        key={`${selectedLearn.id}-${creature.id}`}
                        className="choice-button"
                        type="button"
                        onClick={() => onApply(creature.id, { type: 'learn', specialId: selectedLearn.id })}
                      >
                        Teach {selectedLearn.name} to {creature.name}
                        <br />
                        <small>{creature.specials.length}/2 specials</small>
                      </button>
                    ))
                  ) : (
                    <div className="upgrade-card">
                      <strong>No open slot</strong>
                      <span>Every creature already knows two specials or already has this one.</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
