import { getRoleLabel } from '../hooks/useGameState'
import type { Creature } from '../types'

type CreatureCardProps = {
  creature: Creature
  selected?: boolean
  disabled?: boolean
  compact?: boolean
  onClick?: () => void
}

export function CreatureCard({
  creature,
  selected = false,
  disabled = false,
  compact = false,
  onClick,
}: CreatureCardProps) {
  const hpPercent = creature.maxHp === 0 ? 0 : (creature.currentHp / creature.maxHp) * 100
  const className = [
    'creature-card',
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    compact ? 'is-compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={className} type="button" onClick={onClick} disabled={disabled || !onClick}>
      <div className="creature-card__header">
        <span className="creature-card__emoji" aria-hidden="true">
          {creature.emoji}
        </span>
        <div>
          <h3>{creature.name}</h3>
          <p>{getRoleLabel(creature.role)}</p>
        </div>
      </div>

      <div className="creature-card__stats">
        <span>HP {creature.currentHp}/{creature.maxHp}</span>
        <span>ATK {creature.attack}</span>
        <span>Shield {creature.shield}</span>
      </div>

      <div className="hp-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, hpPercent)}%` }} />
      </div>

      <div className="creature-card__special">
        <strong>{creature.special.name}</strong>
        <span>
          {creature.special.type} {creature.special.value} | cd {creature.special.cooldown}
        </span>
        <span>
          {creature.special.currentCooldown > 0
            ? `ready in ${creature.special.currentCooldown}`
            : 'ready'}
        </span>
      </div>
    </button>
  )
}
