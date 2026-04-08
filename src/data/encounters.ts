import type { EnemyTemplate } from '../types'

function enemyCard(element: 'fire' | 'nature' | 'water', value: number) {
  return { element, value, creatureId: '' }
}

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'scorchling',
    name: 'Scorchling',
    emoji: '🔥',
    maxHp: 28,
    deck: [
      enemyCard('fire', 2),
      enemyCard('fire', 3),
      enemyCard('fire', 4),
      enemyCard('fire', 5),
      enemyCard('nature', 1),
      enemyCard('nature', 3),
      enemyCard('water', 1),
      enemyCard('water', 2),
    ],
  },
  {
    id: 'mossguard',
    name: 'Mossguard',
    emoji: '🌿',
    maxHp: 40,
    deck: [
      enemyCard('nature', 2),
      enemyCard('nature', 3),
      enemyCard('nature', 4),
      enemyCard('nature', 5),
      enemyCard('fire', 2),
      enemyCard('fire', 4),
      enemyCard('water', 2),
      enemyCard('water', 3),
    ],
  },
  {
    id: 'tempest',
    name: 'Tempest',
    emoji: '🌩️',
    maxHp: 48,
    deck: [
      enemyCard('fire', 2),
      enemyCard('fire', 3),
      enemyCard('fire', 4),
      enemyCard('fire', 5),
      enemyCard('nature', 3),
      enemyCard('nature', 4),
      enemyCard('nature', 5),
      enemyCard('water', 2),
      enemyCard('water', 3),
      enemyCard('water', 4),
    ],
  },
]
