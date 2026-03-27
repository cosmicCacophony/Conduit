export type Role = 'offense' | 'defense' | 'support' | 'boss'

export type SpecialType = 'strike' | 'guard' | 'mend'

export type GamePhase =
  | 'title'
  | 'teamSelect'
  | 'combat'
  | 'reward'
  | 'recruit'
  | 'victory'
  | 'defeat'

export type EncounterType = 'fight' | 'recruit' | 'boss'

export type CombatTurn = 'player' | 'enemy'

export interface SpecialTemplate {
  name: string
  type: SpecialType
  value: number
  cooldown: number
}

export interface CreatureTemplate {
  id: string
  name: string
  emoji: string
  role: Role
  maxHp: number
  attack: number
  special: SpecialTemplate
}

export interface Creature extends Omit<CreatureTemplate, 'special'> {
  currentHp: number
  shield: number
  special: SpecialTemplate & {
    currentCooldown: number
  }
}

export interface EncounterDefinition {
  type: EncounterType
  text: string
}

export interface RunStats {
  fightsWon: number
  boostsGiven: number
  recruited: string[]
}

export interface GameState {
  phase: GamePhase
  roster: Creature[]
  availableCreatureIds: string[]
  selectedTeamIds: string[]
  enemy: Creature | null
  encounterIndex: number
  combatLog: string[]
  encounterText: string
  recruitOffer: Creature[]
  combatTurn: CombatTurn
  stats: RunStats
}

export type RewardType = 'hp' | 'atk'

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'SELECT_TEAM'; ids: string[] }
  | { type: 'PLAYER_ACTION'; creatureId: string; action: 'attack' | 'special'; targetId?: string }
  | { type: 'ENEMY_TURN' }
  | { type: 'APPLY_REWARD'; creatureId: string; reward: RewardType }
  | { type: 'RECRUIT'; creatureId: string }
  | { type: 'SKIP_RECRUIT' }
  | { type: 'NEXT_ENCOUNTER' }
  | { type: 'RESTART' }
