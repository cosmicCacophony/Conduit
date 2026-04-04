export type Role = 'offense' | 'defense' | 'support' | 'boss'

export type Element = 'fire' | 'water' | 'nature' | 'shadow'

export type SpecialType = 'strike' | 'guard' | 'mend' | 'weaken' | 'rally' | 'poison' | 'taunt'

export type BehaviorArchetype = 'berserker' | 'guardian' | 'hexer' | 'support' | 'summoner' | 'warden'

export type GamePhase =
  | 'title'
  | 'teamSelect'
  | 'combat'
  | 'reward'
  | 'recruit'
  | 'rest'
  | 'victory'
  | 'defeat'

export type EncounterType = 'fight' | 'elite' | 'recruit' | 'rest' | 'boss'

export type CombatTurn = 'player' | 'enemy'

export type RewardTier = 'normal' | 'elite'

export type SoundCue = 'hit' | 'special' | 'heal' | 'guard' | 'victory' | 'defeat'

export interface SpecialTemplate {
  id: string
  name: string
  type: SpecialType
  value: number
  cooldown: number
  element?: Element
  targetType?: 'enemy' | 'ally' | 'self'
  targetScope?: 'single' | 'all'
  chargeTurns?: number
}

export interface SpecialState extends SpecialTemplate {
  currentCooldown: number
}

export interface CombatIntent {
  action: 'attack' | 'special' | 'charge'
  targetId: string
  specialId?: string
}

export interface ChargeState {
  specialId: string
  targetId: string
  turnsRemaining: number
}

export interface CreatureTemplate {
  id: string
  name: string
  emoji: string
  role: Role
  element: Element
  elementalAttack: number
  maxHp: number
  attack: number
  specials: SpecialTemplate[]
  behavior?: BehaviorArchetype
}

export interface Creature extends Omit<CreatureTemplate, 'specials'> {
  currentHp: number
  shield: number
  weakened: number
  rallied: number
  poison: number
  poisonTurns: number
  tauntTurns: number
  specials: SpecialState[]
  intent?: CombatIntent
  charging?: ChargeState
}

export interface EncounterDefinition {
  id: string
  type: EncounterType
  text: string
  enemyGroupPool?: string[]
  rewardTier?: RewardTier
}

export interface RunStats {
  fightsWon: number
  boostsGiven: number
  recruited: string[]
  encountersCleared: number
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

export interface RunHistoryEntry {
  timestamp: number
  result: 'victory' | 'defeat'
  fightsWon: number
  boostsGiven: number
  encountersCleared: number
  recruited: string[]
  rosterSnapshot: string[]
}

export type RewardType =
  | { type: 'hp' }
  | { type: 'atk' }
  | { type: 'learn'; specialId: string }
  | { type: 'upgradeValue'; specialId: string }
  | { type: 'upgradeCooldown'; specialId: string }

export interface GameState {
  phase: GamePhase
  roster: Creature[]
  availableCreatureIds: string[]
  selectedTeamIds: string[]
  actedCreatureIds: string[]
  enemies: Creature[]
  encounterIndex: number
  combatLog: string[]
  encounterText: string
  recruitOffer: Creature[]
  combatTurn: CombatTurn
  rewardTier: RewardTier
  learnOffers: SpecialTemplate[]
  stats: RunStats
  lastEffect: CombatEffect | null
}

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'SELECT_TEAM'; ids: string[] }
  | {
      type: 'PLAYER_ACTION'
      creatureId: string
      action: 'attack' | 'special'
      specialIndex?: number
      targetId?: string
    }
  | { type: 'ENEMY_TURN' }
  | { type: 'APPLY_REWARD'; creatureId: string; reward: RewardType }
  | { type: 'RECRUIT'; creatureId: string }
  | { type: 'SKIP_RECRUIT' }
  | { type: 'REST_AND_CONTINUE' }
  | { type: 'NEXT_ENCOUNTER' }
  | { type: 'RESTART' }
