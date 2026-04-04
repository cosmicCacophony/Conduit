import { getElementLabel, getIntentLabel, getRoleLabel } from '../hooks/useGameState'
import type { CombatEffect, Creature } from '../types'

type CreatureCardProps = {
  creature: Creature
  selected?: boolean
  disabled?: boolean
  compact?: boolean
  effect?: CombatEffect | null
  showIntent?: boolean
  showLockedSpecials?: boolean
  onClick?: () => void
}

export function CreatureCard({
  creature,
  selected = false,
  disabled = false,
  compact = false,
  effect = null,
  showIntent = false,
  showLockedSpecials = false,
  onClick,
}: CreatureCardProps) {
  const hpPercent = creature.maxHp === 0 ? 0 : (creature.currentHp / creature.maxHp) * 100
  const className = [
    'creature-card',
    `creature-card--${creature.element}`,
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    compact ? 'is-compact' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const effectHitsCreature = effect?.targetIds.includes(creature.id) ?? false

  return (
    <button className={className} type="button" onClick={onClick} disabled={disabled || !onClick}>
      {effectHitsCreature ? (
        <span key={`${creature.id}-${effect?.tick}`} className={`combat-float combat-float--${effect?.kind}`}>
          {effect?.label}
        </span>
      ) : null}

      <div className="creature-card__header">
        <span className="creature-card__emoji" aria-hidden="true">
          {creature.emoji}
        </span>
        <div>
          <h3>{creature.name}</h3>
          <p>
            {getRoleLabel(creature.role)} · {getElementLabel(creature.element)}
          </p>
        </div>
      </div>

      <div className="creature-card__stats">
        <span>HP {creature.currentHp}/{creature.maxHp}</span>
        <span>ATK {creature.attack} + {creature.elementalAttack} {getElementLabel(creature.element).toLowerCase()}</span>
        <span>SPD {creature.speed}</span>
        <span>Shield {creature.shield}</span>
        {creature.weakened > 0 ? <span>Weakened {creature.weakened}</span> : null}
        {creature.rallied > 0 ? <span>Rally {creature.rallied}</span> : null}
        {creature.poisonTurns > 0 ? <span>Poison {creature.poison} for {creature.poisonTurns}</span> : null}
        {creature.charging ? <span>Charging {creature.charging.turnsRemaining}</span> : null}
        {creature.lastStandUsed ? <span>Last Stand spent</span> : null}
      </div>

      <div className="hp-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, hpPercent)}%` }} />
      </div>

      <div className="creature-card__special">
        {creature.specials.map((special, index) => (
          <div key={special.id} className="creature-card__special-row">
            <strong>{special.name}</strong>
            <span>
              {[special.element ? getElementLabel(special.element) : null, special.type, special.value]
                .filter(Boolean)
                .join(' ')} | cd {special.cooldown}
            </span>
            {special.chargeTurns ? <span>charge {special.chargeTurns}</span> : null}
            <span>{special.currentCooldown > 0 ? `ready in ${special.currentCooldown}` : 'ready'}</span>
            {showLockedSpecials && index === 0 && creature.specials.length === 1 ? (
              <span>Second special locked</span>
            ) : null}
          </div>
        ))}
      </div>

      {showIntent ? (
        <div className="creature-card__intent">
          <span>{getIntentLabel(creature)}</span>
        </div>
      ) : null}

      {!compact && creature.specials.length === 1 && showLockedSpecials ? (
        <div className="creature-card__intent">
          <span>Learn one more special to complete this build.</span>
        </div>
      ) : null}

      {!onClick ? (
        <div className="creature-card__footer">
          <span>{creature.currentHp > 0 ? 'Active' : 'Fallen'}</span>
        </div>
      ) : null}
      {compact && creature.specials.length === 1 && showLockedSpecials ? (
        <div className="creature-card__footer">
          <span>Locked slot available</span>
        </div>
      ) : null}
    </button>
  )
}
