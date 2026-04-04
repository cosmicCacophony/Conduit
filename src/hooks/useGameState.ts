import type { CreatureTemplate, Element, Creature } from '../types'

export function getRoleLabel(role: CreatureTemplate['role']) {
  switch (role) {
    case 'offense':
      return 'Offense'
    case 'defense':
      return 'Defense'
    case 'support':
      return 'Support'
    case 'boss':
      return 'Boss'
    default:
      return 'Unknown'
  }
}

export function getElementLabel(element: Element) {
  switch (element) {
    case 'fire':
      return 'Fire'
    case 'water':
      return 'Water'
    case 'nature':
      return 'Nature'
    case 'shadow':
      return 'Shadow'
    default:
      return 'Unknown'
  }
}

export function getIntentLabel(creature: Creature) {
  if (creature.charging) {
    const special = creature.specials.find((entry) => entry.id === creature.charging?.specialId)
    const turns = creature.charging.turnsRemaining ?? special?.chargeTurns ?? 1
    return `Intent: charging ${special?.name ?? 'special'} (${turns})`
  }

  if (!creature.possibleIntents || creature.possibleIntents.length === 0) {
    return 'Waiting'
  }

  const labels = creature.possibleIntents.map((intent) => {
    if (intent.action === 'attack') {
      return 'attack'
    }

    const special = creature.specials.find((entry) => entry.id === intent.specialId)
    if (intent.action === 'charge') {
      return `charge ${special?.name ?? 'special'}`
    }

    return special?.name ?? 'special'
  })

  return `Intent: ${labels.join(' or ')}`
}
