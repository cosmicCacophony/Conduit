import type { Ability, Card, Element, GridCharacter, ReactionType, WindDirection } from './types'

export const GRID_WIDTH = 5
export const GRID_HEIGHT = 5
export const HAND_SIZE = 3
export const TERRAIN_LIFETIME: Record<Element, number> = {
  water: 2,
  fire: 2,
  lightning: 2,
  earth: 3,
}

export const ELEMENT_COLORS: Record<Element, string> = {
  water: '#4ea3d6',
  fire: '#e07a4a',
  lightning: '#e8c948',
  earth: '#7a6549',
}

export const ELEMENT_LABELS: Record<Element, string> = {
  water: 'Water',
  fire: 'Fire',
  lightning: 'Lightning',
  earth: 'Earth',
}

export const ELEMENT_ICONS: Record<Element, string> = {
  water: '~',
  fire: '*',
  lightning: '/',
  earth: '#',
}

export const WIND_ROTATION: WindDirection[] = ['north', 'east', 'south', 'west']

export function nextWind(current: WindDirection): WindDirection {
  const idx = WIND_ROTATION.indexOf(current)
  return WIND_ROTATION[(idx + 1) % WIND_ROTATION.length]
}

export function windToVector(direction: WindDirection): { dx: number; dy: number } {
  switch (direction) {
    case 'north':
      return { dx: 0, dy: -1 }
    case 'south':
      return { dx: 0, dy: 1 }
    case 'east':
      return { dx: 1, dy: 0 }
    case 'west':
      return { dx: -1, dy: 0 }
  }
}

export interface ReactionDef {
  type: ReactionType
  pair: [Element, Element]
  damage: number
  scalesWithChain: boolean
  description: string
}

export const REACTIONS: ReactionDef[] = [
  {
    type: 'electrified',
    pair: ['water', 'lightning'],
    damage: 2,
    scalesWithChain: true,
    description: 'Electrified! Water chain shocks all on it.',
  },
  {
    type: 'steam',
    pair: ['water', 'fire'],
    damage: 0,
    scalesWithChain: false,
    description: 'Steam! Tiles obscured.',
  },
  {
    type: 'plasma',
    pair: ['fire', 'lightning'],
    damage: 3,
    scalesWithChain: true,
    description: 'Plasma! Fire chain ignites all on it.',
  },
  {
    type: 'shatter',
    pair: ['earth', 'lightning'],
    damage: 1,
    scalesWithChain: false,
    description: 'Shatter! Earth shears apart.',
  },
]

export function findReaction(a: Element, b: Element): ReactionDef | null {
  for (const reaction of REACTIONS) {
    const [p1, p2] = reaction.pair
    if ((p1 === a && p2 === b) || (p1 === b && p2 === a)) {
      return reaction
    }
  }
  return null
}

export const ABILITIES: Record<string, Ability> = {
  splash: {
    id: 'splash',
    name: 'Splash',
    description: 'Place water on a tile within 3.',
    manaCost: 1,
    range: 3,
    shape: 'single',
    element: 'water',
    damage: 0,
    placesTerrain: true,
  },
  torrent: {
    id: 'torrent',
    name: 'Torrent',
    description: 'Place water in a 3-tile line.',
    manaCost: 3,
    range: 3,
    shape: 'line3',
    element: 'water',
    damage: 0,
    placesTerrain: true,
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    description: 'Place fire on a tile, deal 1 damage.',
    manaCost: 1,
    range: 3,
    shape: 'single',
    element: 'fire',
    damage: 1,
    placesTerrain: true,
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno',
    description: 'Place fire in a 2x2 area, deal 1 damage.',
    manaCost: 3,
    range: 3,
    shape: 'square2x2',
    element: 'fire',
    damage: 1,
    placesTerrain: true,
  },
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    description: 'Place earth on a tile within 3.',
    manaCost: 1,
    range: 3,
    shape: 'single',
    element: 'earth',
    damage: 0,
    placesTerrain: true,
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    description: 'Place earth in a 2-tile line.',
    manaCost: 2,
    range: 2,
    shape: 'line2',
    element: 'earth',
    damage: 0,
    placesTerrain: true,
  },
  tremor: {
    id: 'tremor',
    name: 'Tremor',
    description: 'Place earth in a + shape on self.',
    manaCost: 3,
    range: 0,
    shape: 'plus',
    element: 'earth',
    damage: 0,
    placesTerrain: true,
    selfTarget: true,
  },
  sparkbolt: {
    id: 'sparkbolt',
    name: 'Sparkbolt',
    description: 'Place lightning, deal 1 damage.',
    manaCost: 1,
    range: 3,
    shape: 'single',
    element: 'lightning',
    damage: 1,
    placesTerrain: true,
  },
  thundercrack: {
    id: 'thundercrack',
    name: 'Thundercrack',
    description: 'Place lightning in a 2x2 area, deal 2 damage.',
    manaCost: 3,
    range: 3,
    shape: 'square2x2',
    element: 'lightning',
    damage: 2,
    placesTerrain: true,
  },
}

export interface CharacterTemplate {
  id: string
  name: string
  emoji: string
  element: Element
  maxHp: number
  abilityIds: string[]
  movementBudget: number
}

export const PLAYER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'tidecaller',
    name: 'Tidecaller',
    emoji: '🌊',
    element: 'water',
    maxHp: 8,
    abilityIds: ['splash', 'torrent'],
    movementBudget: 2,
  },
  {
    id: 'pyromancer',
    name: 'Pyromancer',
    emoji: '🔥',
    element: 'fire',
    maxHp: 7,
    abilityIds: ['ember', 'inferno'],
    movementBudget: 2,
  },
  {
    id: 'geomancer',
    name: 'Geomancer',
    emoji: '🪨',
    element: 'earth',
    maxHp: 10,
    abilityIds: ['boulder', 'wall', 'tremor'],
    movementBudget: 1,
  },
]

export const ENEMY_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'storm-sprite',
    name: 'Storm Sprite',
    emoji: '⚡',
    element: 'lightning',
    maxHp: 6,
    abilityIds: ['sparkbolt', 'thundercrack'],
    movementBudget: 3,
  },
  {
    id: 'ember-wisp',
    name: 'Ember Wisp',
    emoji: '👻',
    element: 'fire',
    maxHp: 6,
    abilityIds: ['ember', 'inferno'],
    movementBudget: 2,
  },
  {
    id: 'moss-golem',
    name: 'Moss Golem',
    emoji: '🌳',
    element: 'earth',
    maxHp: 12,
    abilityIds: ['boulder', 'wall'],
    movementBudget: 1,
  },
]

export function instantiateCharacter(
  template: CharacterTemplate,
  isPlayer: boolean,
  position: { x: number; y: number },
): GridCharacter {
  return {
    id: `${template.id}-${isPlayer ? 'p' : 'e'}`,
    name: template.name,
    emoji: template.emoji,
    element: template.element,
    maxHp: template.maxHp,
    currentHp: template.maxHp,
    mana: 0,
    abilities: template.abilityIds.map((id) => ABILITIES[id]),
    position: { ...position },
    isPlayer,
    hasMoved: false,
    hasActed: false,
    movementBudget: template.movementBudget,
  }
}

export function buildStarterDeck(): Card[] {
  const elements: Element[] = ['water', 'fire', 'lightning', 'earth']
  const cards: Card[] = []
  let id = 0
  for (const element of elements) {
    for (let value = 1; value <= 5; value++) {
      cards.push({ id: `c${id++}`, element, value })
    }
  }
  return cards
}
