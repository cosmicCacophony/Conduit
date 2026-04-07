import type { Element, ElementCard, Spell, SpellEffect } from '../types'

const ELEMENT_ORDER: Record<Element, number> = { fire: 0, nature: 1, water: 2 }

function sortElements(elements: Element[]): Element[] {
  return [...elements].sort((a, b) => ELEMENT_ORDER[a] - ELEMENT_ORDER[b])
}

function spellKey(elements: Element[]): string {
  return sortElements(elements).join(',')
}

function valuesOf(cards: ElementCard[], element: Element): number[] {
  return cards.filter((c) => c.element === element).map((c) => c.value)
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

export function describeEffect(effect: SpellEffect): string {
  const parts: string[] = []
  if (effect.damage) parts.push(`${effect.damage} damage`)
  if (effect.block) parts.push(`${effect.block} block`)
  if (effect.heal) parts.push(`${effect.heal} heal`)
  if (effect.burn) parts.push(`${effect.burn} burn`)
  if (effect.cleanse) parts.push('cleanse')
  return parts.join(' + ')
}

const SPELLS: Spell[] = [
  // Tier 1 -- Cantrips (1 card, value = card value)
  {
    id: 'spark',
    name: 'Spark',
    elements: ['fire'],
    tier: 1,
    compute: (cards) => ({ damage: valuesOf(cards, 'fire')[0] ?? 0 }),
    rangeDescription: '2-5 damage',
  },
  {
    id: 'bark',
    name: 'Bark',
    elements: ['nature'],
    tier: 1,
    compute: (cards) => ({ block: valuesOf(cards, 'nature')[0] ?? 0 }),
    rangeDescription: '2-5 block',
  },
  {
    id: 'mend',
    name: 'Mend',
    elements: ['water'],
    tier: 1,
    compute: (cards) => ({ heal: valuesOf(cards, 'water')[0] ?? 0 }),
    rangeDescription: '2-5 heal',
  },

  // Tier 2 -- Same-element combos (2 cards, sum + combo bonus)
  {
    id: 'fire-blast',
    name: 'Fire Blast',
    elements: ['fire', 'fire'],
    tier: 2,
    compute: (cards) => ({ damage: 3 + sum(valuesOf(cards, 'fire')) }),
    rangeDescription: '7-13 damage',
  },
  {
    id: 'ironbark',
    name: 'Ironbark',
    elements: ['nature', 'nature'],
    tier: 2,
    compute: (cards) => ({ block: 2 + sum(valuesOf(cards, 'nature')) }),
    rangeDescription: '6-12 block',
  },
  {
    id: 'torrent',
    name: 'Torrent',
    elements: ['water', 'water'],
    tier: 2,
    compute: (cards) => ({ heal: 1 + sum(valuesOf(cards, 'water')) }),
    rangeDescription: '5-11 heal',
  },

  // Tier 2 -- Hybrid combos (2 cards, each value maps to its element role)
  {
    id: 'fireball',
    name: 'Fireball',
    elements: ['fire', 'nature'],
    tier: 2,
    compute: (cards) => {
      const fire = valuesOf(cards, 'fire')
      const nature = valuesOf(cards, 'nature')
      return { damage: (fire[0] ?? 0) + (nature[0] ?? 0), burn: 2 }
    },
    rangeDescription: '4-10 damage + 2 burn',
  },
  {
    id: 'scald',
    name: 'Scald',
    elements: ['fire', 'water'],
    tier: 2,
    compute: (cards) => ({
      damage: valuesOf(cards, 'fire')[0] ?? 0,
      block: valuesOf(cards, 'water')[0] ?? 0,
    }),
    rangeDescription: '2-5 damage + 2-5 block',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    elements: ['nature', 'water'],
    tier: 2,
    compute: (cards) => ({
      block: valuesOf(cards, 'nature')[0] ?? 0,
      heal: valuesOf(cards, 'water')[0] ?? 0,
    }),
    rangeDescription: '2-5 block + 2-5 heal',
  },

  // Tier 3 -- Power (3 cards, sum + big combo bonus)
  {
    id: 'inferno',
    name: 'Inferno',
    elements: ['fire', 'fire', 'fire'],
    tier: 3,
    compute: (cards) => ({ damage: 5 + sum(valuesOf(cards, 'fire')) }),
    rangeDescription: '11-20 damage',
  },
  {
    id: 'fortress',
    name: 'Fortress',
    elements: ['nature', 'nature', 'nature'],
    tier: 3,
    compute: (cards) => ({ block: 3 + sum(valuesOf(cards, 'nature')) }),
    rangeDescription: '9-18 block',
  },
  {
    id: 'deluge',
    name: 'Deluge',
    elements: ['water', 'water', 'water'],
    tier: 3,
    compute: (cards) => ({ heal: 1 + sum(valuesOf(cards, 'water')), cleanse: true }),
    rangeDescription: '7-16 heal + cleanse',
  },
  {
    id: 'prism',
    name: 'Prism',
    elements: ['fire', 'nature', 'water'],
    tier: 3,
    compute: (cards) => ({
      damage: 1 + (valuesOf(cards, 'fire')[0] ?? 0),
      block: 1 + (valuesOf(cards, 'nature')[0] ?? 0),
      heal: valuesOf(cards, 'water')[0] ?? 0,
    }),
    rangeDescription: '3-6 damage + 3-6 block + 2-5 heal',
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
