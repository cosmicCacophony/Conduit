export type Element = 'fire' | 'water' | 'nature'

export type GamePhase = 'title' | 'teamSelect' | 'combat' | 'victory' | 'defeat'

export type SoundCue = 'hit' | 'special' | 'heal' | 'guard' | 'victory' | 'defeat'

export interface ElementCard {
  element: Element
  value: number
  creatureId: string
}

export interface CreatureTemplate {
  id: string
  name: string
  emoji: string
  element: Element
  cardValues: number[]
  signature?: ComboResult
}

export interface ComboResult {
  damage?: number
  block?: number
  heal?: number
  burn?: number
  thorns?: number
  regen?: number
  cleanse?: number
  vulnerable?: number
}

export type RelicId =
  | 'ember-heart'
  | 'stone-skin'
  | 'glass-cannon'
  | 'mirror-shard'
  | 'tide-turner'
  | 'wellspring'

export interface Relic {
  id: RelicId
  name: string
  emoji: string
  description: string
}

export interface EnemyTemplate {
  id: string
  name: string
  emoji: string
  maxHp: number
  deck: ElementCard[]
}

export interface EnemyState {
  id: string
  name: string
  emoji: string
  maxHp: number
  currentHp: number
  block: number
  burn: number
  regen: number
  vulnerable: number
  drawPile: ElementCard[]
  discardPile: ElementCard[]
  currentCard: ElementCard | null
}

export interface CombatEffect {
  tick: number
  kind: 'damage' | 'heal' | 'shield' | 'buff' | 'victory' | 'defeat'
  targetIds: string[]
  label: string
  value?: number
  sound: SoundCue
  shake?: boolean
}

export interface RunStats {
  fightsWon: number
}

export interface RunHistoryEntry {
  timestamp: number
  result: 'victory' | 'defeat'
  fightsWon: number
  team: string[]
}

export interface GameState {
  phase: GamePhase
  team: CreatureTemplate[]
  fullDeck: ElementCard[]
  drawPile: ElementCard[]
  discardPile: ElementCard[]
  hand: ElementCard[]
  selectedIndices: number[]

  playerHp: number
  playerMaxHp: number
  playerBlock: number
  playerBurn: number
  playerThorns: number
  playerRegen: number

  mana: number
  bankedMana: number
  hasSurge: boolean
  cardsPlayedThisTurn: number

  encounters: EnemyTemplate[]
  encounterIndex: number
  enemy: EnemyState | null

  selectedRelic: RelicId | null

  combatLog: string[]
  lastEffect: CombatEffect | null
  stats: RunStats
}

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'SELECT_TEAM'; creatureIds: string[] }
  | { type: 'SELECT_RELIC'; relicId: RelicId }
  | { type: 'TOGGLE_CARD'; index: number }
  | { type: 'PLAY_CARDS' }
  | { type: 'END_TURN' }
  | { type: 'RESTART' }
