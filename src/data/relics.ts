import type { Relic } from '../types'

export const ALL_RELICS: Relic[] = [
  {
    id: 'ember-heart',
    name: 'Ember Heart',
    emoji: '❤️‍🔥',
    description: 'Enemy burn stacks never decrease. Burns are permanent.',
  },
  {
    id: 'stone-skin',
    name: 'Stone Skin',
    emoji: '🪨',
    description: 'Your block does not reset between rounds.',
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    emoji: '💎',
    description: 'Deal +50% damage. Take +50% damage.',
  },
  {
    id: 'mirror-shard',
    name: 'Mirror Shard',
    emoji: '🪞',
    description: 'See the exact value of enemy intents, not just the type.',
  },
  {
    id: 'tide-turner',
    name: 'Tide Turner',
    emoji: '🌊',
    description: 'When you pass, deal damage equal to your banked mana.',
  },
  {
    id: 'wellspring',
    name: 'Wellspring',
    emoji: '♨️',
    description: 'Heal 2 HP at the start of each round.',
  },
]

export function getRelicById(id: string): Relic | undefined {
  return ALL_RELICS.find((r) => r.id === id)
}
