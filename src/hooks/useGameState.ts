import { useMemo, useReducer } from 'react'

import { ENCOUNTERS } from '../data/encounters'
import {
  BOSS_CREATURE,
  ENEMY_CREATURES,
  RECRUITABLE_CREATURES,
  STARTER_CREATURES,
  instantiateCreature,
} from '../data/creatures'
import type { Creature, CreatureTemplate, GameAction, GameState, RewardType } from '../types'

const MAX_LOG_LINES = 8

const initialState: GameState = {
  phase: 'title',
  roster: [],
  availableCreatureIds: [],
  selectedTeamIds: [],
  enemy: null,
  encounterIndex: 0,
  combatLog: [],
  encounterText: '',
  recruitOffer: [],
  combatTurn: 'player',
  stats: {
    fightsWon: 0,
    boostsGiven: 0,
    recruited: [],
  },
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }

  return next
}

function getLivingRoster(roster: Creature[]): Creature[] {
  return roster.filter((creature) => creature.currentHp > 0)
}

function getEncounterText(encounterIndex: number): string {
  return ENCOUNTERS[encounterIndex]?.text ?? ''
}

function getEncounterType(encounterIndex: number) {
  return ENCOUNTERS[encounterIndex]?.type ?? 'fight'
}

function pushLog(lines: string[], entry: string): string[] {
  return [...lines, entry].slice(-MAX_LOG_LINES)
}

function updateCreatureList(
  creatures: Creature[],
  creatureId: string,
  updater: (creature: Creature) => Creature,
): Creature[] {
  return creatures.map((creature) => (creature.id === creatureId ? updater(creature) : creature))
}

function applyDamage(target: Creature, amount: number): { creature: Creature; damage: number; blocked: number } {
  if (target.shield > 0) {
    const blocked = Math.min(target.shield, amount)
    const remainingDamage = Math.max(0, amount - target.shield)

    return {
      creature: {
        ...target,
        shield: 0,
        currentHp: Math.max(0, target.currentHp - remainingDamage),
      },
      damage: remainingDamage,
      blocked,
    }
  }

  return {
    creature: {
      ...target,
      currentHp: Math.max(0, target.currentHp - amount),
    },
    damage: amount,
    blocked: 0,
  }
}

function tickCooldowns(creatures: Creature[]): Creature[] {
  return creatures.map((creature) => ({
    ...creature,
    special: {
      ...creature.special,
      currentCooldown: Math.max(0, creature.special.currentCooldown - 1),
    },
  }))
}

function prepareRosterForBattle(roster: Creature[]): Creature[] {
  return roster.map((creature) => ({
    ...creature,
    shield: 0,
    special: {
      ...creature.special,
      currentCooldown: 0,
    },
  }))
}

function createEnemy(encounterIndex: number): Creature {
  if (getEncounterType(encounterIndex) === 'boss') {
    return instantiateCreature(BOSS_CREATURE)
  }

  const template = shuffle(ENEMY_CREATURES)[0] ?? ENEMY_CREATURES[0]
  return instantiateCreature(template)
}

function createRecruitOffer(): Creature[] {
  return shuffle(RECRUITABLE_CREATURES)
    .slice(0, 2)
    .map((template) => instantiateCreature(template))
}

function createAvailableCreatureIds(roster: Creature[]): string[] {
  const livingRoster = getLivingRoster(roster)

  if (livingRoster.length <= 3) {
    return livingRoster.map((creature) => creature.id)
  }

  return shuffle(livingRoster)
    .slice(0, 3)
    .map((creature) => creature.id)
}

function moveToEncounter(encounterIndex: number, roster: Creature[], stats: GameState['stats']): GameState {
  const encounterType = getEncounterType(encounterIndex)
  const livingCount = getLivingRoster(roster).length

  if (encounterType !== 'recruit' && livingCount === 0) {
    return {
      ...initialState,
      phase: 'defeat',
      roster,
      encounterIndex,
      encounterText: getEncounterText(encounterIndex),
      stats,
    }
  }

  if (encounterType === 'recruit') {
    return {
      ...initialState,
      phase: 'recruit',
      roster,
      encounterIndex,
      encounterText: getEncounterText(encounterIndex),
      recruitOffer: createRecruitOffer(),
      stats,
    }
  }

  return {
    ...initialState,
    phase: 'teamSelect',
    roster,
    encounterIndex,
    encounterText: getEncounterText(encounterIndex),
    availableCreatureIds: createAvailableCreatureIds(roster),
    stats,
  }
}

function applyRewardToRoster(roster: Creature[], creatureId: string, reward: RewardType): Creature[] {
  return updateCreatureList(roster, creatureId, (creature) => {
    if (reward === 'atk') {
      return {
        ...creature,
        attack: creature.attack + 1,
      }
    }

    const nextMaxHp = creature.maxHp + 2
    return {
      ...creature,
      maxHp: nextMaxHp,
      currentHp: Math.min(nextMaxHp, creature.currentHp + 2),
    }
  })
}

function resolveStrikeSpecial(
  roster: Creature[],
  enemy: Creature,
  actor: Creature,
  log: string[],
): { roster: Creature[]; enemy: Creature; log: string[] } {
  const nextEnemy = {
    ...enemy,
    currentHp: Math.max(0, enemy.currentHp - actor.special.value),
  }

  const nextRoster = updateCreatureList(roster, actor.id, (creature) => ({
    ...creature,
    special: {
      ...creature.special,
      currentCooldown: creature.special.cooldown,
    },
  }))

  return {
    roster: nextRoster,
    enemy: nextEnemy,
    log: pushLog(log, `${actor.name} uses ${actor.special.name} for ${actor.special.value} damage.`),
  }
}

function resolveGuardOrMendSpecial(
  roster: Creature[],
  actor: Creature,
  targetId: string,
  log: string[],
): { roster: Creature[]; log: string[] } {
  const withCooldown = updateCreatureList(roster, actor.id, (creature) => ({
    ...creature,
    special: {
      ...creature.special,
      currentCooldown: creature.special.cooldown,
    },
  }))

  if (actor.special.type === 'guard') {
    return {
      roster: updateCreatureList(withCooldown, targetId, (creature) => ({
        ...creature,
        shield: creature.currentHp > 0 ? actor.special.value : creature.shield,
      })),
      log: pushLog(log, `${actor.name} shields an ally for the next hit.`),
    }
  }

  return {
    roster: updateCreatureList(withCooldown, targetId, (creature) => ({
      ...creature,
      currentHp:
        creature.currentHp > 0
          ? Math.min(creature.maxHp, creature.currentHp + actor.special.value)
          : creature.currentHp,
    })),
    log: pushLog(log, `${actor.name} restores ${actor.special.value} HP.`),
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_RUN': {
      const roster = STARTER_CREATURES.map((template) => instantiateCreature(template))
      return moveToEncounter(0, roster, initialState.stats)
    }

    case 'SELECT_TEAM': {
      const ids = action.ids.filter((id) => state.availableCreatureIds.includes(id))
      const roster = prepareRosterForBattle(state.roster)
      const selectedTeamIds = ids.filter((id) => roster.some((creature) => creature.id === id && creature.currentHp > 0))
      const enemy = createEnemy(state.encounterIndex)
      const log = [
        state.encounterText,
        `A wild ${enemy.name} emerges from the hush.`,
      ]

      return {
        ...state,
        phase: 'combat',
        roster,
        selectedTeamIds,
        enemy,
        combatLog: log,
        combatTurn: 'player',
      }
    }

    case 'PLAYER_ACTION': {
      if (state.phase !== 'combat' || state.combatTurn !== 'player' || !state.enemy) {
        return state
      }

      const actor = state.roster.find((creature) => creature.id === action.creatureId)
      if (!actor || actor.currentHp <= 0 || !state.selectedTeamIds.includes(actor.id)) {
        return state
      }

      if (action.action === 'attack') {
        const nextEnemy = {
          ...state.enemy,
          currentHp: Math.max(0, state.enemy.currentHp - actor.attack),
        }
        const combatLog = pushLog(
          state.combatLog,
          `${actor.name} attacks for ${actor.attack} damage.`,
        )

        if (nextEnemy.currentHp <= 0) {
          const phase = getEncounterType(state.encounterIndex) === 'boss' ? 'victory' : 'reward'
          return {
            ...state,
            phase,
            enemy: nextEnemy,
            combatLog: pushLog(combatLog, `${nextEnemy.name} fades back into the mist.`),
            combatTurn: 'player',
            stats: {
              ...state.stats,
              fightsWon: state.stats.fightsWon + 1,
            },
          }
        }

        return {
          ...state,
          enemy: nextEnemy,
          combatLog,
          combatTurn: 'enemy',
        }
      }

      if (actor.special.currentCooldown > 0) {
        return state
      }

      if (actor.special.type === 'strike') {
        const specialResult = resolveStrikeSpecial(state.roster, state.enemy, actor, state.combatLog)

        if (specialResult.enemy.currentHp <= 0) {
          const phase = getEncounterType(state.encounterIndex) === 'boss' ? 'victory' : 'reward'
          return {
            ...state,
            phase,
            roster: specialResult.roster,
            enemy: specialResult.enemy,
            combatLog: pushLog(
              specialResult.log,
              `${specialResult.enemy.name} dissolves into silence.`,
            ),
            combatTurn: 'player',
            stats: {
              ...state.stats,
              fightsWon: state.stats.fightsWon + 1,
            },
          }
        }

        return {
          ...state,
          roster: specialResult.roster,
          enemy: specialResult.enemy,
          combatLog: specialResult.log,
          combatTurn: 'enemy',
        }
      }

      if (!action.targetId) {
        return state
      }

      const target = state.roster.find((creature) => creature.id === action.targetId)
      if (!target || target.currentHp <= 0 || !state.selectedTeamIds.includes(target.id)) {
        return state
      }

      const supportResult = resolveGuardOrMendSpecial(
        state.roster,
        actor,
        target.id,
        state.combatLog,
      )
      return {
        ...state,
        roster: supportResult.roster,
        combatLog: supportResult.log,
        combatTurn: 'enemy',
      }
    }

    case 'ENEMY_TURN': {
      if (state.phase !== 'combat' || state.combatTurn !== 'enemy' || !state.enemy) {
        return state
      }

      const livingTeam = state.roster.filter(
        (creature) => state.selectedTeamIds.includes(creature.id) && creature.currentHp > 0,
      )

      if (livingTeam.length === 0) {
        return {
          ...state,
          phase: 'defeat',
          combatTurn: 'player',
          combatLog: pushLog(state.combatLog, 'Your connection to the island falls silent.'),
        }
      }

      const target = shuffle(livingTeam)[0] ?? livingTeam[0]
      const canUseSpecial = state.enemy.special.currentCooldown === 0
      const useSpecial = canUseSpecial && Math.random() < 0.5
      const rawDamage = useSpecial ? state.enemy.special.value : state.enemy.attack
      const attackName = useSpecial ? state.enemy.special.name : 'Attack'
      const resolvedTarget = applyDamage(target, rawDamage)
      const rosterAfterHit = updateCreatureList(state.roster, target.id, () => resolvedTarget.creature)
      const rosterAfterTick = tickCooldowns(rosterAfterHit)
      const nextEnemy = {
        ...state.enemy,
        special: {
          ...state.enemy.special,
          currentCooldown: useSpecial
            ? state.enemy.special.cooldown
            : Math.max(0, state.enemy.special.currentCooldown - 1),
        },
      }

      let combatLog = pushLog(
        state.combatLog,
        `${state.enemy.name} uses ${attackName} on ${target.name}.`,
      )

      if (resolvedTarget.blocked > 0) {
        combatLog = pushLog(combatLog, `${target.name} blocks ${resolvedTarget.blocked} damage.`)
      }

      if (resolvedTarget.damage > 0) {
        combatLog = pushLog(combatLog, `${target.name} loses ${resolvedTarget.damage} HP.`)
      }

      if (resolvedTarget.creature.currentHp <= 0) {
        combatLog = pushLog(combatLog, `${target.name} can no longer answer the call.`)
      }

      const survivors = rosterAfterTick.filter(
        (creature) => state.selectedTeamIds.includes(creature.id) && creature.currentHp > 0,
      )

      if (survivors.length === 0) {
        return {
          ...state,
          phase: 'defeat',
          roster: rosterAfterTick,
          enemy: nextEnemy,
          combatTurn: 'player',
          combatLog: pushLog(combatLog, 'The run ends in the island hush.'),
        }
      }

      return {
        ...state,
        roster: rosterAfterTick,
        enemy: nextEnemy,
        combatTurn: 'player',
        combatLog,
      }
    }

    case 'APPLY_REWARD': {
      const nextRoster = applyRewardToRoster(state.roster, action.creatureId, action.reward)
      return {
        ...state,
        roster: nextRoster,
        stats: {
          ...state.stats,
          boostsGiven: state.stats.boostsGiven + 1,
        },
      }
    }

    case 'RECRUIT': {
      const recruit = state.recruitOffer.find((creature) => creature.id === action.creatureId)
      if (!recruit) {
        return state
      }

      return {
        ...state,
        roster: [...state.roster, recruit],
        stats: {
          ...state.stats,
          recruited: [...state.stats.recruited, recruit.name],
        },
      }
    }

    case 'SKIP_RECRUIT':
      return state

    case 'NEXT_ENCOUNTER': {
      const nextIndex = state.encounterIndex + 1
      if (nextIndex >= ENCOUNTERS.length) {
        return state
      }

      return moveToEncounter(nextIndex, state.roster, state.stats)
    }

    case 'RESTART':
      return initialState

    default:
      return state
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const selectedTeam = useMemo(
    () => state.roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
    [state.roster, state.selectedTeamIds],
  )

  const availableCreatures = useMemo(
    () => state.roster.filter((creature) => state.availableCreatureIds.includes(creature.id)),
    [state.roster, state.availableCreatureIds],
  )

  return {
    state,
    dispatch,
    selectedTeam,
    availableCreatures,
  }
}

export function getRoleLabel(role: CreatureTemplate['role']) {
  switch (role) {
    case 'offense':
      return 'Offense'
    case 'defense':
      return 'Defense'
    case 'support':
      return 'Support'
    case 'boss':
      return 'Boss'
    default:
      return 'Unknown'
  }
}
