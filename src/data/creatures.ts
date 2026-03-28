import type { Creature, CreatureTemplate, Role, SpecialTemplate } from '../types'

export const STARTER_CREATURES: CreatureTemplate[] = [
  {
    id: 'ember',
    name: 'Ember',
    emoji: '🔥',
    role: 'offense',
    maxHp: 10,
    attack: 5,
    specials: [{ id: 'flare', name: 'Flare', type: 'strike', value: 8, cooldown: 3 }],
  },
  {
    id: 'moss',
    name: 'Moss',
    emoji: '🪨',
    role: 'defense',
    maxHp: 18,
    attack: 3,
    specials: [{ id: 'stone-wall', name: 'Stone Wall', type: 'guard', value: 8, cooldown: 2 }],
  },
  {
    id: 'drift',
    name: 'Drift',
    emoji: '🌫️',
    role: 'support',
    maxHp: 13,
    attack: 3,
    specials: [{ id: 'mend', name: 'Mend', type: 'mend', value: 8, cooldown: 2 }],
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
    specials: [{ id: 'brace', name: 'Brace', type: 'guard', value: 7, cooldown: 2 }],
  },
  {
    id: 'shade',
    name: 'Shade',
    emoji: '🕯️',
    role: 'offense',
    maxHp: 9,
    attack: 6,
    specials: [{ id: 'haunt', name: 'Haunt', type: 'strike', value: 10, cooldown: 4 }],
  },
  {
    id: 'ripple',
    name: 'Ripple',
    emoji: '💧',
    role: 'support',
    maxHp: 14,
    attack: 3,
    specials: [{ id: 'soothe', name: 'Soothe', type: 'mend', value: 9, cooldown: 3 }],
  },
  {
    id: 'thorn',
    name: 'Thorn',
    emoji: '🌿',
    role: 'offense',
    maxHp: 12,
    attack: 5,
    specials: [{ id: 'lash', name: 'Lash', type: 'strike', value: 7, cooldown: 2 }],
  },
  {
    id: 'lilt',
    name: 'Lilt',
    emoji: '🪷',
    role: 'support',
    maxHp: 12,
    attack: 4,
    specials: [{ id: 'calm-tide', name: 'Calm Tide', type: 'mend', value: 6, cooldown: 2 }],
  },
  {
    id: 'reed',
    name: 'Reed',
    emoji: '🌾',
    role: 'defense',
    maxHp: 17,
    attack: 3,
    specials: [{ id: 'rooted', name: 'Rooted', type: 'guard', value: 7, cooldown: 3 }],
  },
]

export const ENEMY_TEMPLATES: Record<string, CreatureTemplate> = {
  bramble: {
    id: 'bramble',
    name: 'Bramble',
    emoji: '🍂',
    role: 'offense',
    maxHp: 14,
    attack: 3,
    specials: [{ id: 'snap', name: 'Snap', type: 'strike', value: 5, cooldown: 3 }],
  },
  gale: {
    id: 'gale',
    name: 'Gale',
    emoji: '🪶',
    role: 'offense',
    maxHp: 13,
    attack: 4,
    specials: [{ id: 'shear', name: 'Shear', type: 'strike', value: 6, cooldown: 3 }],
  },
  mire: {
    id: 'mire',
    name: 'Mire',
    emoji: '🫧',
    role: 'defense',
    maxHp: 19,
    attack: 2,
    specials: [{ id: 'silt-veil', name: 'Silt Veil', type: 'guard', value: 7, cooldown: 2 }],
  },
  hollow: {
    id: 'hollow',
    name: 'Hollow',
    emoji: '🦴',
    role: 'support',
    maxHp: 15,
    attack: 3,
    specials: [{ id: 'echo-mend', name: 'Echo Mend', type: 'mend', value: 5, cooldown: 3 }],
  },
  wispkeeper: {
    id: 'wispkeeper',
    name: 'Wispkeeper',
    emoji: '🪔',
    role: 'offense',
    maxHp: 22,
    attack: 4,
    specials: [{ id: 'ember-arc', name: 'Ember Arc', type: 'strike', value: 8, cooldown: 3 }],
  },
  tidemaw: {
    id: 'tidemaw',
    name: 'Tidemaw',
    emoji: '🦑',
    role: 'support',
    maxHp: 24,
    attack: 3,
    specials: [{ id: 'undertow', name: 'Undertow', type: 'strike', value: 8, cooldown: 3 }],
  },
  warden: {
    id: 'warden',
    name: 'The Warden',
    emoji: '🌑',
    role: 'boss',
    maxHp: 32,
    attack: 5,
    specials: [{ id: 'shadow-crush', name: 'Shadow Crush', type: 'strike', value: 10, cooldown: 3 }],
  },
}

export const ENEMY_GROUPS: Record<string, CreatureTemplate[]> = {
  brambleSolo: [ENEMY_TEMPLATES.bramble],
  galeSolo: [ENEMY_TEMPLATES.gale],
  brambleGale: [ENEMY_TEMPLATES.bramble, ENEMY_TEMPLATES.gale],
  mireHollow: [ENEMY_TEMPLATES.mire, ENEMY_TEMPLATES.hollow],
  elitePoolA: [ENEMY_TEMPLATES.wispkeeper],
  elitePoolB: [ENEMY_TEMPLATES.tidemaw],
  wardenSolo: [ENEMY_TEMPLATES.warden],
}

export const LEARNABLE_ABILITIES: Record<Exclude<Role, 'boss'>, SpecialTemplate[]> = {
  offense: [
    { id: 'expose-weakness', name: 'Expose Weakness', type: 'weaken', value: 4, cooldown: 2 },
    { id: 'afterglow', name: 'Afterglow', type: 'strike', value: 6, cooldown: 1 },
  ],
  defense: [
    { id: 'anchor-call', name: 'Anchor Call', type: 'rally', value: 3, cooldown: 2 },
    { id: 'bulwark', name: 'Bulwark', type: 'guard', value: 8, cooldown: 3 },
  ],
  support: [
    { id: 'kindle-song', name: 'Kindle Song', type: 'rally', value: 4, cooldown: 2 },
    { id: 'renew', name: 'Renew', type: 'mend', value: 9, cooldown: 3 },
  ],
}

export function instantiateCreature(template: CreatureTemplate): Creature {
  return {
    ...template,
    currentHp: template.maxHp,
    shield: 0,
    weakened: 0,
    rallied: 0,
    specials: template.specials.map((special) => ({
      ...special,
      currentCooldown: 0,
    })),
  }
}
