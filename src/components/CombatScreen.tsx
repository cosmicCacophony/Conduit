import { useMemo, useState } from 'react'

import { CreatureCard } from './CreatureCard'
import type { Creature } from '../types'

type PendingTarget = {
  actorId: string
}

type CombatScreenProps = {
  team: Creature[]
  enemy: Creature
  combatTurn: 'player' | 'enemy'
  combatLog: string[]
  onAction: (creatureId: string, action: 'attack' | 'special', targetId?: string) => void
}

export function CombatScreen({
  team,
  enemy,
  combatTurn,
  combatLog,
  onAction,
}: CombatScreenProps) {
  const livingTeam = useMemo(() => team.filter((creature) => creature.currentHp > 0), [team])
  const [selectedActorId, setSelectedActorId] = useState<string | null>(livingTeam[0]?.id ?? null)
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null)

  const actor =
    livingTeam.find((creature) => creature.id === selectedActorId) ?? livingTeam[0] ?? null
  const actorCanUseSpecial =
    actor !== null && actor.special.currentCooldown === 0 && combatTurn === 'player'
  const visiblePendingTarget =
    combatTurn === 'player' && actor && pendingTarget?.actorId === actor.id ? pendingTarget : null

  function handleAttack() {
    if (!actor || combatTurn !== 'player') {
      return
    }

    setPendingTarget(null)
    onAction(actor.id, 'attack')
  }

  function handleSpecial() {
    if (!actor || !actorCanUseSpecial) {
      return
    }

    if (actor.special.type === 'strike') {
        setPendingTarget(null)
      onAction(actor.id, 'special')
      return
    }

    if (livingTeam.length === 1) {
        setPendingTarget(null)
      onAction(actor.id, 'special', livingTeam[0].id)
      return
    }

    setPendingTarget({ actorId: actor.id })
  }

  return (
    <section className="screen">
      <div className="combat-header">
        <div>
          <p className="eyebrow">Combat</p>
          <h2>The island answers back</h2>
          <p className="screen-copy">
            {combatTurn === 'player'
              ? 'Choose a creature and act.'
              : `${enemy.name} is moving...`}
          </p>
        </div>
      </div>

      <div className="combat-layout">
        <div className="combat-column">
          <h3>Your pair</h3>
          <div className="card-grid">
            {team.map((creature) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                compact
                selected={creature.id === actor?.id}
                disabled={combatTurn !== 'player' || creature.currentHp <= 0}
                onClick={() => setSelectedActorId(creature.id)}
              />
            ))}
          </div>
        </div>

        <div className="combat-column combat-column--enemy">
          <h3>Enemy</h3>
          <CreatureCard creature={enemy} compact />
        </div>
      </div>

      <div className="combat-actions">
        <button
          className="primary-button"
          type="button"
          disabled={combatTurn !== 'player' || !actor}
          onClick={handleAttack}
        >
          Attack {actor ? `(${actor.attack})` : ''}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!actorCanUseSpecial}
          onClick={handleSpecial}
        >
          {actor ? actor.special.name : 'Special'}
        </button>
      </div>

      {visiblePendingTarget ? (
        <div className="target-panel">
          <p className="muted">Choose who receives the effect.</p>
          <div className="target-list">
            {livingTeam.map((creature) => (
              <button
                key={creature.id}
                className="target-button"
                type="button"
                onClick={() => {
                  onAction(visiblePendingTarget.actorId, 'special', creature.id)
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
