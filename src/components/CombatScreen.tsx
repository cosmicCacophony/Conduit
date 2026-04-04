import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { CombatEffect, Creature } from '../types'

type PendingTarget = {
  actorId: string
  action: 'attack' | 'special'
  specialIndex?: number
  targetSide: 'ally' | 'enemy'
}

type CombatScreenProps = {
  team: Creature[]
  enemies: Creature[]
  combatTurn: 'player' | 'enemy'
  actedCreatureIds: string[]
  combatLog: string[]
  lastEffect: CombatEffect | null
  onAction: (
    creatureId: string,
    action: 'attack' | 'special',
    specialIndex?: number,
    targetId?: string,
  ) => void
}

export function CombatScreen({
  team,
  enemies,
  combatTurn,
  actedCreatureIds,
  combatLog,
  lastEffect,
  onAction,
}: CombatScreenProps) {
  const livingTeam = useMemo(() => team.filter((creature) => creature.currentHp > 0), [team])
  const livingEnemies = useMemo(() => enemies.filter((creature) => creature.currentHp > 0), [enemies])
  const tauntingEnemies = useMemo(
    () => livingEnemies.filter((creature) => creature.tauntTurns > 0),
    [livingEnemies],
  )
  const [selectedActorId, setSelectedActorId] = useState<string | null>(livingTeam[0]?.id ?? null)
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null)

  const actor =
    livingTeam.find((creature) => creature.id === selectedActorId) ?? livingTeam[0] ?? null
  const actorHasActed = actor ? actedCreatureIds.includes(actor.id) : false
  const remainingActionCount = livingTeam.filter(
    (creature) => !actedCreatureIds.includes(creature.id),
  ).length
  const visiblePendingTarget = combatTurn === 'player' ? pendingTarget : null

  function handleAttack() {
    if (!actor || combatTurn !== 'player' || actorHasActed) {
      return
    }

    const validTargets = tauntingEnemies.length > 0 ? tauntingEnemies : livingEnemies

    if (validTargets.length === 1) {
      setPendingTarget(null)
      onAction(actor.id, 'attack', undefined, validTargets[0].id)
      return
    }

    setPendingTarget({ actorId: actor.id, action: 'attack', targetSide: 'enemy' })
  }

  function handleSpecial(specialIndex: number) {
    if (!actor || combatTurn !== 'player' || actorHasActed) {
      return
    }

    const special = actor.specials[specialIndex]
    if (!special || special.currentCooldown > 0) {
      return
    }

    if (special.targetType === 'enemy' || special.type === 'strike' || special.type === 'weaken' || special.type === 'poison') {
      if (special.targetScope === 'all') {
        setPendingTarget(null)
        onAction(actor.id, 'special', specialIndex, livingEnemies[0]?.id)
        return
      }

      if (livingEnemies.length === 1) {
        setPendingTarget(null)
        onAction(actor.id, 'special', specialIndex, livingEnemies[0].id)
        return
      }

      setPendingTarget({ actorId: actor.id, action: 'special', specialIndex, targetSide: 'enemy' })
      return
    }

    if (special.targetType === 'self') {
      setPendingTarget(null)
      onAction(actor.id, 'special', specialIndex, actor.id)
      return
    }

    if (livingTeam.length === 1) {
      setPendingTarget(null)
      onAction(actor.id, 'special', specialIndex, livingTeam[0].id)
      return
    }

    setPendingTarget({ actorId: actor.id, action: 'special', specialIndex, targetSide: 'ally' })
  }

  return (
    <section className="screen">
      <div className="combat-header">
        <div>
          <p className="eyebrow">Combat</p>
          <h2>The island answers back</h2>
          <p className="screen-copy">
            {combatTurn === 'player'
              ? `Choose a creature and act. ${remainingActionCount} action${remainingActionCount === 1 ? '' : 's'} left this round.`
              : 'The island moves. Hold the line.'}
          </p>
        </div>
      </div>

      <div className={`combat-layout ${lastEffect?.shake ? 'is-shaking' : ''}`}>
        <div className="combat-column">
          <h3>Your pair</h3>
          <div className="card-grid">
            {team.map((creature) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                compact
                selected={creature.id === actor?.id}
                disabled={
                  combatTurn !== 'player' ||
                  creature.currentHp <= 0 ||
                  actedCreatureIds.includes(creature.id)
                }
                effect={lastEffect}
                showLockedSpecials
                onClick={() => setSelectedActorId(creature.id)}
              />
            ))}
          </div>
        </div>

        <div className="combat-column combat-column--enemy">
          <h3>Enemies</h3>
          <div className="card-grid">
            {enemies.map((enemy) => (
              <CreatureCard
                key={enemy.id}
                creature={enemy}
                compact
                effect={lastEffect}
                enemyTeam={enemies}
                playerTeam={team}
                showIntent
              />
            ))}
          </div>
        </div>
      </div>

      <div className="combat-actions">
        <button
          className="primary-button"
          type="button"
          disabled={combatTurn !== 'player' || !actor || actorHasActed}
          onClick={handleAttack}
        >
          Attack {actor ? `(${actor.attack})` : ''}
        </button>
        {actor
          ? [0, 1].map((index) => {
              const special = actor.specials[index]

              if (!special) {
                return (
                  <button key={`locked-${index}`} className="secondary-button" type="button" disabled>
                    Locked
                  </button>
                )
              }

              return (
                <button
                  key={special.id}
                  className="secondary-button"
                  type="button"
                  disabled={combatTurn !== 'player' || special.currentCooldown > 0 || actorHasActed}
                  onClick={() => handleSpecial(index)}
                >
                  {special.name}
                </button>
              )
            })
          : null}
      </div>

      {visiblePendingTarget ? (
        <div className="target-panel">
          <p className="muted">
            {visiblePendingTarget.targetSide === 'enemy'
              ? tauntingEnemies.length > 0 && visiblePendingTarget.action === 'attack'
                ? 'A taunt is active. Basic attacks must answer it first.'
                : 'Choose who takes the hit.'
              : 'Choose who receives the effect.'}
          </p>
          <div className="target-list">
            {(
              visiblePendingTarget.targetSide === 'enemy'
                ? visiblePendingTarget.action === 'attack' && tauntingEnemies.length > 0
                  ? tauntingEnemies
                  : livingEnemies
                : livingTeam
            ).map((creature) => (
              <button
                key={creature.id}
                className="target-button"
                type="button"
                onClick={() => {
                  onAction(
                    visiblePendingTarget.actorId,
                    visiblePendingTarget.action,
                    visiblePendingTarget.specialIndex,
                    creature.id,
                  )
                  setPendingTarget(null)
                }}
              >
                {creature.emoji} {creature.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="log-panel">
        <h3>Combat log</h3>
        <ul>
          {combatLog.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
