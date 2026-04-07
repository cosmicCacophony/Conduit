export type Element = 'fire' | 'water' | 'nature'

export type GamePhase = 'title' | 'teamSelect' | 'combat' | 'victory' | 'defeat'

export type SoundCue = 'hit' | 'special' | 'heal' | 'guard' | 'victory' | 'defeat'

export interface CreatureTemplate {
  id: string
  name: string
  emoji: string
  element: Element
  cardCount: number
}

export interface SpellEffect {
  damage?: number
  block?: number
  heal?: number
  burn?: number
  cleanse?: boolean
}

export interface Spell {
  id: string
  name: string
  elements: Element[]
  tier: number
  effect: SpellEffect
  description: string
}

export type EnemyIntentType = 'attack' | 'defend' | 'burn' | 'charge'

export interface EnemyIntent {
  type: EnemyIntentType
  value: number
  label: string
}

export interface EnemyTemplate {
  id: string
  name: string
  emoji: string
  maxHp: number
  intents: EnemyIntent[]
}

export interface EnemyState {
  id: string
  name: string
  emoji: string
  maxHp: number
  currentHp: number
  block: number
  burn: number
  currentIntent: EnemyIntent
  intents: EnemyIntent[]
  charging: number | null
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
  deck: Element[]
  hand: Element[]
  selectedIndices: number[]
  playerHp: number
  playerMaxHp: number
  playerBlock: number
  playerBurn: number
  encounters: EnemyTemplate[]
  encounterIndex: number
  enemy: EnemyState | null
  combatLog: string[]
  lastEffect: CombatEffect | null
  stats: RunStats
}

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'SELECT_TEAM'; creatureIds: string[] }
  | { type: 'TOGGLE_CARD'; index: number }
  | { type: 'CAST_SPELL' }
  | { type: 'END_TURN' }
  | { type: 'RESTART' }
