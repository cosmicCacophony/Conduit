import type { EnemyTemplate } from '../types'

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'bramble',
    name: 'Bramble',
    emoji: '🍂',
    maxHp: 25,
    intents: [
      { type: 'attack', value: 6, label: 'Attack 6' },
      { type: 'attack', value: 8, label: 'Attack 8' },
    ],
  },
  {
    id: 'gale',
    name: 'Gale',
    emoji: '🪶',
    maxHp: 35,
    intents: [
      { type: 'attack', value: 8, label: 'Attack 8' },
      { type: 'attack', value: 12, label: 'Attack 12' },
      { type: 'defend', value: 6, label: 'Defend 6' },
    ],
  },
  {
    id: 'mire',
    name: 'Mire',
    emoji: '🫧',
    maxHp: 40,
    intents: [
      { type: 'attack', value: 10, label: 'Attack 10' },
      { type: 'burn', value: 4, label: 'Burn 4' },
      { type: 'charge', value: 18, label: 'Charging Heavy Strike' },
    ],
  },
  {
    id: 'warden',
    name: 'The Warden',
    emoji: '🌑',
    maxHp: 55,
    intents: [
      { type: 'attack', value: 12, label: 'Attack 12' },
      { type: 'attack', value: 16, label: 'Attack 16' },
      { type: 'defend', value: 8, label: 'Defend 8' },
      { type: 'charge', value: 24, label: 'Charging Eclipse' },
    ],
  },
]
