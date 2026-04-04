export type Role = 'offense' | 'defense' | 'support' | 'boss'

export type Element = 'fire' | 'water' | 'nature' | 'shadow'

export type SpecialType = 'strike' | 'guard' | 'mend' | 'weaken' | 'rally' | 'poison'

export type BehaviorArchetype = 'berserker' | 'guardian' | 'hexer' | 'support' | 'warden'

export type GamePhase =
  | 'title'
  | 'pathChoice'
  | 'teamSelect'
  | 'combat'
  | 'reward'
  | 'recruit'
  | 'rest'
  | 'event'
  | 'victory'
  | 'defeat'

export type EncounterType = 'fight' | 'elite' | 'recruit' | 'rest' | 'boss' | 'event'

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
  persistsOnSwitch?: boolean
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
  speed: number
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
  specials: SpecialState[]
  intent?: CombatIntent
  possibleIntents?: CombatIntent[]
  charging?: ChargeState
  lastStandUsed: boolean
}

export interface EncounterDefinition {
  id: string
  type: EncounterType
  text: string
  enemyGroupPool?: string[]
  resolvedEnemyGroupId?: string
  previewEnemyName?: string
  previewEnemyElement?: Element
  rewardTier?: RewardTier
  eventId?: string
}

export interface MapLayer {
  id: string
  options: EncounterDefinition[]
}

export interface ArtifactDefinition {
  id: string
  name: string
  description: string
  emoji: string
}

export interface EventChoice {
  id: string
  label: string
  description: string
  requiresCreature?: boolean
}

export interface EventDefinition {
  id: string
  title: string
  text: string
  choices: EventChoice[]
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
  | { type: 'speed' }
  | { type: 'rest' }
  | { type: 'learn'; specialId: string }
  | { type: 'artifact'; artifactId: string }

export interface GameState {
  phase: GamePhase
  roster: Creature[]
  runMap: MapLayer[]
  availableCreatureIds: string[]
  selectedTeamIds: string[]
  activeCreatureId: string | null
  enemies: Creature[]
  enemyQueueIndex: number
  encounterIndex: number
  combatLog: string[]
  encounterText: string
  recruitOffer: Creature[]
  pathOptions: EncounterDefinition[]
  currentEncounter: EncounterDefinition | null
  currentEventId: string | null
  combatTurn: CombatTurn
  freeSwitch: boolean
  switchesUsedThisFight: number
  rewardTier: RewardTier
  learnOffers: SpecialTemplate[]
  artifactOffers: ArtifactDefinition[]
  artifacts: string[]
  stats: RunStats
  lastEffect: CombatEffect | null
}

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'CHOOSE_PATH'; encounterId: string }
  | { type: 'SELECT_TEAM'; ids: string[] }
  | { type: 'SWITCH'; creatureId: string }
  | {
      type: 'PLAYER_ACTION'
      action: 'attack' | 'special'
      specialIndex?: number
    }
  | { type: 'ENEMY_TURN' }
  | { type: 'APPLY_REWARD'; reward: RewardType; creatureId?: string }
  | { type: 'RECRUIT'; creatureId: string }
  | { type: 'SKIP_RECRUIT' }
  | { type: 'REST_AND_CONTINUE' }
  | { type: 'RESOLVE_EVENT'; choiceId: string; creatureId?: string }
  | { type: 'NEXT_ENCOUNTER' }
  | { type: 'RESTART' }
