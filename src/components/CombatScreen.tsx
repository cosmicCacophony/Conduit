import { useMemo } from 'react'

import { CreatureCard } from './CreatureCard'
import type { CombatEffect, Creature } from '../types'

type CombatScreenProps = {
  team: Creature[]
  activeCreature: Creature | null
  enemies: Creature[]
  enemyQueueIndex: number
  freeSwitch: boolean
  combatLog: string[]
  lastEffect: CombatEffect | null
  artifacts: string[]
  onAction: (action: 'attack' | 'special', specialIndex?: number) => void
  onSwitch: (creatureId: string) => void
}

export function CombatScreen({
  team,
  activeCreature,
  enemies,
  enemyQueueIndex,
  freeSwitch,
  combatLog,
  lastEffect,
  artifacts,
  onAction,
  onSwitch,
}: CombatScreenProps) {
  const currentEnemy = enemies[enemyQueueIndex] ?? null
  const bench = useMemo(
    () => team.filter((creature) => creature.currentHp > 0 && creature.id !== activeCreature?.id),
    [activeCreature?.id, team],
  )
  const upcomingEnemies = enemies.slice(enemyQueueIndex + 1).filter((creature) => creature.currentHp > 0)

  return (
    <section className="screen">
      <div className="combat-header">
        <div>
          <p className="eyebrow">Combat</p>
          <h2>Hold the front</h2>
          <p className="screen-copy">
            {freeSwitch
              ? 'A free switch is available. Rotate if you want, or stay in and press the advantage.'
              : 'One creature fights at a time. Attacking means committing to the exchange.'}
          </p>
        </div>
      </div>

      <div className={`combat-layout ${lastEffect?.shake ? 'is-shaking' : ''}`}>
        <div className="combat-column">
          <h3>Active Creature</h3>
          {activeCreature ? (
            <CreatureCard creature={activeCreature} effect={lastEffect} showLockedSpecials />
          ) : (
            <div className="summary-card">
              <strong>No active creature</strong>
              <span>Swap in someone from the bench.</span>
            </div>
          )}

          {bench.length > 0 ? (
            <div className="screen-section">
              <p className="eyebrow">Bench</p>
              <div className="card-grid">
                {bench.map((creature) => (
                  <CreatureCard
                    key={creature.id}
                    creature={creature}
                    compact
                    onClick={() => onSwitch(creature.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="combat-column combat-column--enemy">
          <h3>Enemy</h3>
          {currentEnemy ? (
            <CreatureCard creature={currentEnemy} compact effect={lastEffect} showIntent />
          ) : (
            <div className="summary-card">
              <strong>No enemy</strong>
            </div>
          )}

          {upcomingEnemies.length > 0 ? (
            <div className="screen-section">
              <p className="eyebrow">Queue</p>
              <div className="card-grid">
                {upcomingEnemies.map((enemy) => (
                  <CreatureCard key={enemy.id} creature={enemy} compact disabled />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="combat-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!activeCreature || !currentEnemy}
          onClick={() => onAction('attack')}
        >
          Attack {activeCreature ? `(${activeCreature.attack})` : ''}
        </button>
        {activeCreature
          ? [0, 1].map((index) => {
              const special = activeCreature.specials[index]
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
                  disabled={special.currentCooldown > 0 || !currentEnemy}
                  onClick={() => onAction('special', index)}
                >
                  {special.name}
                </button>
              )
            })
          : null}
      </div>

      {artifacts.length > 0 ? (
        <div className="summary-list">
          <h3>Artifacts</h3>
          <ul>
            {artifacts.map((artifactId) => (
              <li key={artifactId}>{artifactId}</li>
            ))}
          </ul>
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
