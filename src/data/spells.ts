import type { Element, Spell } from '../types'

const ELEMENT_ORDER: Record<Element, number> = { fire: 0, nature: 1, water: 2 }

function sortElements(elements: Element[]): Element[] {
  return [...elements].sort((a, b) => ELEMENT_ORDER[a] - ELEMENT_ORDER[b])
}

function spellKey(elements: Element[]): string {
  return sortElements(elements).join(',')
}

const SPELLS: Spell[] = [
  // Tier 1 — Cantrips (1 card)
  {
    id: 'spark',
    name: 'Spark',
    elements: ['fire'],
    tier: 1,
    effect: { damage: 4 },
    description: '4 damage',
  },
  {
    id: 'bark',
    name: 'Bark',
    elements: ['nature'],
    tier: 1,
    effect: { block: 4 },
    description: '4 block',
  },
  {
    id: 'mend',
    name: 'Mend',
    elements: ['water'],
    tier: 1,
    effect: { heal: 3 },
    description: '3 heal',
  },

  // Tier 2 — Combos (2 cards)
  {
    id: 'fire-blast',
    name: 'Fire Blast',
    elements: ['fire', 'fire'],
    tier: 2,
    effect: { damage: 10 },
    description: '10 damage',
  },
  {
    id: 'ironbark',
    name: 'Ironbark',
    elements: ['nature', 'nature'],
    tier: 2,
    effect: { block: 9 },
    description: '9 block',
  },
  {
    id: 'torrent',
    name: 'Torrent',
    elements: ['water', 'water'],
    tier: 2,
    effect: { heal: 8 },
    description: '8 heal',
  },
  {
    id: 'fireball',
    name: 'Fireball',
    elements: ['fire', 'nature'],
    tier: 2,
    effect: { damage: 7, burn: 2 },
    description: '7 damage + 2 burn',
  },
  {
    id: 'scald',
    name: 'Scald',
    elements: ['fire', 'water'],
    tier: 2,
    effect: { damage: 5, block: 4 },
    description: '5 damage + 4 block',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    elements: ['nature', 'water'],
    tier: 2,
    effect: { block: 4, heal: 4 },
    description: '4 block + 4 heal',
  },

  // Tier 3 — Power (3 cards)
  {
    id: 'inferno',
    name: 'Inferno',
    elements: ['fire', 'fire', 'fire'],
    tier: 3,
    effect: { damage: 16 },
    description: '16 damage',
  },
  {
    id: 'fortress',
    name: 'Fortress',
    elements: ['nature', 'nature', 'nature'],
    tier: 3,
    effect: { block: 14 },
    description: '14 block',
  },
  {
    id: 'deluge',
    name: 'Deluge',
    elements: ['water', 'water', 'water'],
    tier: 3,
    effect: { heal: 12, cleanse: true },
    description: '12 heal + cleanse burn',
  },
  {
    id: 'prism',
    name: 'Prism',
    elements: ['fire', 'nature', 'water'],
    tier: 3,
    effect: { damage: 7, block: 5, heal: 3 },
    description: '7 damage + 5 block + 3 heal',
  },
]

const SPELL_MAP = new Map<string, Spell>()
for (const spell of SPELLS) {
  SPELL_MAP.set(spellKey(spell.elements), spell)
}

export function findSpell(elements: Element[]): Spell | null {
  if (elements.length === 0) {
    return null
  }
  return SPELL_MAP.get(spellKey(elements)) ?? null
}

export function getAllSpells(): Spell[] {
  return SPELLS
}
