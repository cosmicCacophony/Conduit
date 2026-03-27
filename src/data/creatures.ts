import type { Creature, CreatureTemplate } from '../types'

export const STARTER_CREATURES: CreatureTemplate[] = [
  {
    id: 'ember',
    name: 'Ember',
    emoji: '🔥',
    role: 'offense',
    maxHp: 10,
    attack: 5,
    special: { name: 'Flare', type: 'strike', value: 8, cooldown: 3 },
  },
  {
    id: 'moss',
    name: 'Moss',
    emoji: '🪨',
    role: 'defense',
    maxHp: 18,
    attack: 3,
    special: { name: 'Stone Wall', type: 'guard', value: 6, cooldown: 2 },
  },
  {
    id: 'drift',
    name: 'Drift',
    emoji: '🌫️',
    role: 'support',
    maxHp: 13,
    attack: 3,
    special: { name: 'Mend', type: 'mend', value: 7, cooldown: 2 },
  },
]

export const RECRUITABLE_CREATURES: CreatureTemplate[] = [
  {
    id: 'pebble',
    name: 'Pebble',
    emoji: '🪵',
    role: 'defense',
    maxHp: 16,
    attack: 4,
    special: { name: 'Brace', type: 'guard', value: 5, cooldown: 2 },
  },
  {
    id: 'shade',
    name: 'Shade',
    emoji: '🕯️',
    role: 'offense',
    maxHp: 9,
    attack: 6,
    special: { name: 'Haunt', type: 'strike', value: 10, cooldown: 4 },
  },
  {
    id: 'ripple',
    name: 'Ripple',
    emoji: '💧',
    role: 'support',
    maxHp: 14,
    attack: 3,
    special: { name: 'Soothe', type: 'mend', value: 8, cooldown: 3 },
  },
  {
    id: 'thorn',
    name: 'Thorn',
    emoji: '🌿',
    role: 'offense',
    maxHp: 12,
    attack: 5,
    special: { name: 'Lash', type: 'strike', value: 7, cooldown: 2 },
  },
]

export const ENEMY_CREATURES: CreatureTemplate[] = [
  {
    id: 'bramble',
    name: 'Bramble',
    emoji: '🍂',
    role: 'offense',
    maxHp: 16,
    attack: 4,
    special: { name: 'Snap', type: 'strike', value: 7, cooldown: 2 },
  },
  {
    id: 'gale',
    name: 'Gale',
    emoji: '🪶',
    role: 'offense',
    maxHp: 14,
    attack: 5,
    special: { name: 'Shear', type: 'strike', value: 8, cooldown: 3 },
  },
  {
    id: 'mire',
    name: 'Mire',
    emoji: '🫧',
    role: 'defense',
    maxHp: 18,
    attack: 3,
    special: { name: 'Crush', type: 'strike', value: 6, cooldown: 2 },
  },
  {
    id: 'hollow',
    name: 'Hollow',
    emoji: '🦴',
    role: 'support',
    maxHp: 15,
    attack: 4,
    special: { name: 'Echo Bite', type: 'strike', value: 9, cooldown: 3 },
  },
]

export const BOSS_CREATURE: CreatureTemplate = {
  id: 'warden',
  name: 'The Warden',
  emoji: '🌑',
  role: 'boss',
  maxHp: 28,
  attack: 5,
  special: { name: 'Shadow Crush', type: 'strike', value: 10, cooldown: 3 },
}

export function instantiateCreature(template: CreatureTemplate): Creature {
  return {
    ...template,
    currentHp: template.maxHp,
    shield: 0,
    special: {
      ...template.special,
      currentCooldown: 0,
    },
  }
}
