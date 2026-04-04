import { useMemo, useState } from 'react'

import { getElementLabel } from '../hooks/useGameState'
import type { ArtifactDefinition, Creature, RewardType, SpecialTemplate } from '../types'

type RewardScreenProps = {
  rewardTier: 'normal' | 'elite'
  creatures: Creature[]
  learnOffers: SpecialTemplate[]
  artifactOffers: ArtifactDefinition[]
  onApply: (reward: RewardType, creatureId?: string) => void
}

function getSpecialDescription(special: SpecialTemplate) {
  switch (special.type) {
    case 'strike':
      return `Deal ${special.value} typed damage`
    case 'guard':
      return `Gain ${special.value} shield`
    case 'mend':
      return `Heal ${special.value} HP`
    case 'weaken':
      return `Mark the enemy so the next hit deals +${special.value}`
    case 'rally':
      return `Gain +${special.value} on the next basic attack`
    case 'poison':
      return `Poison for ${special.value} each round`
    default:
      return `${special.type} ${special.value}`
  }
}

export function RewardScreen({
  rewardTier,
  creatures,
  learnOffers,
  artifactOffers,
  onApply,
}: RewardScreenProps) {
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(creatures[0]?.id ?? null)
  const [selectedLearnId, setSelectedLearnId] = useState<string | null>(learnOffers[0]?.id ?? null)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(artifactOffers[0]?.id ?? null)

  const selectedLearn = useMemo(
    () => learnOffers.find((offer) => offer.id === selectedLearnId) ?? null,
    [learnOffers, selectedLearnId],
  )
  const eligibleLearners = useMemo(
    () =>
      selectedLearn
        ? creatures.filter(
            (creature) =>
              creature.currentHp > 0 &&
              creature.specials.length < 2 &&
              creature.specials.every((special) => special.id !== selectedLearn.id),
          )
        : [],
    [creatures, selectedLearn],
  )

  return (
    <section className="screen">
      <p className="eyebrow">{rewardTier === 'elite' ? 'Elite reward' : 'After the fight'}</p>
      <h2>{rewardTier === 'elite' ? 'Choose one deeper edge' : 'Choose one path forward'}</h2>
      <p className="screen-copy">
        You only get one lane. Draft new coverage, train a creature, take a team-wide rest, or claim an artifact after elite fights.
      </p>

      <div className="upgrade-grid">
        <div className="upgrade-card">
          <strong>Draft</strong>
          <span>Pick one special, then choose who learns it.</span>
          {learnOffers.length > 0 ? (
            <>
              <div className="choice-row">
                {learnOffers.map((offer) => (
                  <button
                    key={offer.id}
                    className={`choice-button ${offer.id === selectedLearnId ? 'is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedLearnId(offer.id)}
                  >
                    {offer.name}
                    <br />
                    <small>
                      {[offer.element ? getElementLabel(offer.element) : null, offer.type].filter(Boolean).join(' · ')}
                    </small>
                  </button>
                ))}
              </div>
              {selectedLearn ? (
                <div className="choice-row">
                  {eligibleLearners.map((creature) => (
                    <button
                      key={`${selectedLearn.id}-${creature.id}`}
                      className="choice-button"
                      type="button"
                      onClick={() => onApply({ type: 'learn', specialId: selectedLearn.id }, creature.id)}
                    >
                      Teach {selectedLearn.name} to {creature.name}
                      <br />
                      <small>{getSpecialDescription(selectedLearn)}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <span>No valid draft options remain.</span>
          )}
        </div>

        <div className="upgrade-card">
          <strong>Train</strong>
          <span>Choose one creature and sharpen one stat.</span>
          <div className="card-grid">
            {creatures.map((creature) => (
              <button
                key={creature.id}
                className={`choice-button ${creature.id === selectedCreatureId ? 'is-selected' : ''}`}
                type="button"
                onClick={() => setSelectedCreatureId(creature.id)}
              >
                {creature.name}
                <br />
                <small>HP {creature.currentHp}/{creature.maxHp} · ATK {creature.attack} · SPD {creature.speed}</small>
              </button>
            ))}
          </div>
          {selectedCreatureId ? (
            <div className="choice-row">
              <button className="choice-button" type="button" onClick={() => onApply({ type: 'hp' }, selectedCreatureId)}>
                +10 Max HP and heal 10
              </button>
              <button className="choice-button" type="button" onClick={() => onApply({ type: 'atk' }, selectedCreatureId)}>
                +5 Attack
              </button>
              <button className="choice-button" type="button" onClick={() => onApply({ type: 'speed' }, selectedCreatureId)}>
                +1 Speed
              </button>
            </div>
          ) : null}
        </div>

        <div className="upgrade-card">
          <strong>Rest</strong>
          <span>Heal every living creature for 40% of its maximum HP.</span>
          <button className="choice-button" type="button" onClick={() => onApply({ type: 'rest' })}>
            Take the team-wide rest
          </button>
        </div>

        {artifactOffers.length > 0 ? (
          <div className="upgrade-card">
            <strong>Artifact</strong>
            <span>Claim one run-defining relic.</span>
            <div className="choice-row">
              {artifactOffers.map((artifact) => (
                <button
                  key={artifact.id}
                  className={`choice-button ${artifact.id === selectedArtifactId ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedArtifactId(artifact.id)}
                >
                  {artifact.emoji} {artifact.name}
                  <br />
                  <small>{artifact.description}</small>
                </button>
              ))}
            </div>
            {selectedArtifactId ? (
              <button
                className="choice-button"
                type="button"
                onClick={() => onApply({ type: 'artifact', artifactId: selectedArtifactId })}
              >
                Take this artifact
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
