export type Element = 'water' | 'fire' | 'lightning' | 'earth'

export type WindDirection = 'north' | 'east' | 'south' | 'west'

export type ReactionType = 'electrified' | 'steam' | 'plasma' | 'shatter'

export interface Position {
  x: number
  y: number
}

export interface Terrain {
  element: Element
  turnsRemaining: number
  placedBy: 'player' | 'enemy'
}

export interface Tile {
  x: number
  y: number
  terrain: Terrain | null
  ghostTerrain: Terrain | null
}

export type AbilityShape = 'single' | 'line2' | 'line3' | 'plus' | 'square2x2'

export interface Ability {
  id: string
  name: string
  description: string
  manaCost: number
  range: number
  shape: AbilityShape
  element: Element
  damage: number
  placesTerrain: boolean
  selfTarget?: boolean
}

export interface GridCharacter {
  id: string
  name: string
  emoji: string
  element: Element
  maxHp: number
  currentHp: number
  mana: number
  abilities: Ability[]
  position: Position
  isPlayer: boolean
  hasMoved: boolean
  hasActed: boolean
  movementBudget: number
}

export interface Card {
  id: string
  element: Element
  value: number
}

export interface FlashEffect {
  tick: number
  kind: 'cascade' | 'damage' | 'place' | 'flow'
  positions: Position[]
  reaction?: ReactionType
}

export type BattlePhase =
  | 'assign'
  | 'action'
  | 'enemy'
  | 'flow'
  | 'cascade'
  | 'cleanup'
  | 'victory'
  | 'defeat'

export interface SelectedAction {
  characterId: string
  abilityId: string
}

export type LogDetail =
  | {
      kind: 'cascade'
      reactionType: ReactionType
      primaryElement: Element
      secondaryElement: Element
      primaryTiles: Position[]
      secondaryTiles: Position[]
      splashTiles: Position[]
      damagedCharIds: string[]
    }
  | {
      kind: 'ability'
      actorId: string
      abilityId: string
      element: Element
      tiles: Position[]
      damagedCharIds: string[]
    }

export interface LogEntry {
  id: string
  message: string
  turn: number
  detail?: LogDetail
}

export type BonusKind = 'mend'

export interface BonusTile {
  kind: BonusKind
  position: Position
}

export interface EnemyIntent {
  enemyId: string
  plannedMove: Position | null
  plannedAbility: {
    abilityId: string
    targetTile: Position
  } | null
}

export interface BattleState {
  grid: Tile[][]
  width: number
  height: number
  playerChars: GridCharacter[]
  enemyChars: GridCharacter[]
  deck: Card[]
  discard: Card[]
  hand: Card[]
  assignments: Record<string, string>
  wind: WindDirection
  windQueue: WindDirection[]
  turnNumber: number
  phase: BattlePhase
  log: LogEntry[]
  actionOrder: string[]
  currentActorId: string | null
  selectedAction: SelectedAction | null
  pendingFlash: FlashEffect | null
  bonusTiles: BonusTile[]
  enemyIntents: EnemyIntent[]
}
