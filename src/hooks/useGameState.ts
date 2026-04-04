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
  if (!creature.intent) {
    return 'Waiting'
  }

  const special = creature.specials.find((entry) => entry.id === creature.intent?.specialId)

  if (creature.intent.action === 'attack') {
    return 'Intent: attack'
  }

  if (creature.intent.action === 'charge') {
    const turns = creature.charging?.turnsRemaining ?? special?.chargeTurns ?? 1
    return `Intent: charging ${special?.name ?? 'special'} (${turns})`
  }

  return `Intent: ${special?.name ?? 'special'}`
}
