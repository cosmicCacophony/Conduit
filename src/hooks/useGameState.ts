import { useMemo, useReducer } from 'react'

import { ENCOUNTERS } from '../data/encounters'
import {
  ENEMY_GROUPS,
  LEARNABLE_ABILITIES,
  RECRUITABLE_CREATURES,
  STARTER_CREATURES,
  instantiateCreature,
} from '../data/creatures'
import type {
  CombatEffect,
  CombatIntent,
  Creature,
  CreatureTemplate,
  GameAction,
  GameState,
  RewardType,
  Role,
  SpecialState,
  SpecialTemplate,
} from '../types'

const MAX_LOG_LINES = 10

const initialStats: GameState['stats'] = {
  fightsWon: 0,
  boostsGiven: 0,
  recruited: [],
  encountersCleared: 0,
}

const initialState: GameState = {
  phase: 'title',
  roster: [],
  availableCreatureIds: [],
  selectedTeamIds: [],
  actedCreatureIds: [],
  enemies: [],
  encounterIndex: 0,
  combatLog: [],
  encounterText: '',
  recruitOffer: [],
  combatTurn: 'player',
  rewardTier: 'normal',
  learnOffers: {},
  stats: initialStats,
  lastEffect: null,
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

function sample<T>(items: T[]): T {
  return shuffle(items)[0] ?? items[0]
}

function getEncounter(encounterIndex: number) {
  return ENCOUNTERS[encounterIndex]
}

function getLivingCreatures(creatures: Creature[]): Creature[] {
  return creatures.filter((creature) => creature.currentHp > 0)
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

function updateSpecial(
  creatures: Creature[],
  creatureId: string,
  specialIndex: number,
  updater: (special: SpecialState) => SpecialState,
): Creature[] {
  return updateCreatureList(creatures, creatureId, (creature) => ({
    ...creature,
    specials: creature.specials.map((special, index) =>
      index === specialIndex ? updater(special) : special,
    ),
  }))
}

function decrementCooldowns(creatures: Creature[]): Creature[] {
  return creatures.map((creature) => ({
    ...creature,
    specials: creature.specials.map((special) => ({
      ...special,
      currentCooldown: Math.max(0, special.currentCooldown - 1),
    })),
  }))
}

function prepareRosterForBattle(roster: Creature[]): Creature[] {
  return roster.map((creature) => ({
    ...creature,
    shield: 0,
    weakened: 0,
    rallied: 0,
    specials: creature.specials.map((special) => ({
      ...special,
      currentCooldown: 0,
    })),
  }))
}

function createEnemyGroup(encounterIndex: number): Creature[] {
  const encounter = getEncounter(encounterIndex)
  const groupPool = encounter?.enemyGroupPool ?? []
  const groupId = sample(groupPool)
  const group = ENEMY_GROUPS[groupId] ?? []
  return group.map((template) => instantiateCreature(template))
}

function createRecruitOffer(roster: Creature[]): Creature[] {
  const ownedIds = new Set(roster.map((creature) => creature.id))
  return shuffle(RECRUITABLE_CREATURES)
    .filter((template) => !ownedIds.has(template.id))
    .slice(0, 2)
    .map((template) => instantiateCreature(template))
}

function createAvailableCreatureIds(roster: Creature[]): string[] {
  const livingRoster = getLivingCreatures(roster)

  if (livingRoster.length <= 3) {
    return livingRoster.map((creature) => creature.id)
  }

  return shuffle(livingRoster)
    .slice(0, 3)
    .map((creature) => creature.id)
}

function createLearnOffers(roster: Creature[]): Record<string, SpecialTemplate | null> {
  const offers: Record<string, SpecialTemplate | null> = {}

  for (const creature of roster) {
    if (creature.role === 'boss' || creature.specials.length >= 2) {
      offers[creature.id] = null
      continue
    }

    const knownIds = new Set(creature.specials.map((special) => special.id))
    const pool = shuffle(LEARNABLE_ABILITIES[creature.role as Exclude<Role, 'boss'>])
    offers[creature.id] = pool.find((special) => !knownIds.has(special.id)) ?? null
  }

  return offers
}

function createEffect(nextTick: number, effect: Omit<CombatEffect, 'tick'>): CombatEffect {
  return {
    tick: nextTick,
    ...effect,
  }
}

function consumeWeaken(target: Creature) {
  return {
    nextTarget: {
      ...target,
      weakened: 0,
    },
    bonus: target.weakened,
  }
}

function applyDamage(target: Creature, amount: number) {
  const weakenedResult = consumeWeaken(target)
  const totalDamage = amount + weakenedResult.bonus

  if (weakenedResult.nextTarget.shield > 0) {
    const blocked = Math.min(weakenedResult.nextTarget.shield, totalDamage)
    const remainingDamage = Math.max(0, totalDamage - weakenedResult.nextTarget.shield)

    return {
      creature: {
        ...weakenedResult.nextTarget,
        shield: 0,
        currentHp: Math.max(0, weakenedResult.nextTarget.currentHp - remainingDamage),
      },
      damage: remainingDamage,
      blocked,
      bonus: weakenedResult.bonus,
    }
  }

  return {
    creature: {
      ...weakenedResult.nextTarget,
      currentHp: Math.max(0, weakenedResult.nextTarget.currentHp - totalDamage),
    },
    damage: totalDamage,
    blocked: 0,
    bonus: weakenedResult.bonus,
  }
}

function chooseLowestHpTarget(creatures: Creature[]): Creature | null {
  return (
    [...creatures]
      .filter((creature) => creature.currentHp > 0)
      .sort((left, right) => left.currentHp - right.currentHp)[0] ?? null
  )
}

function chooseEnemyAttackTarget(team: Creature[]): Creature | null {
  const livingTeam = team.filter((creature) => creature.currentHp > 0)
  if (livingTeam.length === 0) {
    return null
  }

  const lowestHpTarget = chooseLowestHpTarget(livingTeam)
  if (!lowestHpTarget) {
    return livingTeam[0] ?? null
  }

  if (livingTeam.length === 1 || Math.random() < 0.6) {
    return lowestHpTarget
  }

  const otherTargets = livingTeam.filter((creature) => creature.id !== lowestHpTarget.id)
  return sample(otherTargets.length > 0 ? otherTargets : livingTeam)
}

function chooseEnemyIntent(enemy: Creature, enemies: Creature[], team: Creature[]): CombatIntent {
  const target = chooseEnemyAttackTarget(team) ?? team[0]
  const readySpecial = enemy.specials.find((special) => special.currentCooldown === 0)

  if (!readySpecial || !target) {
    return { action: 'attack', targetId: target?.id ?? '' }
  }

  if (readySpecial.type === 'guard') {
    const ally = chooseLowestHpTarget(
      enemies.filter((creature) => creature.currentHp > 0 && creature.shield === 0),
    )
    if (ally && ally.currentHp <= Math.ceil(ally.maxHp / 2)) {
      return { action: 'special', specialId: readySpecial.id, targetId: ally.id }
    }
  }

  if (readySpecial.type === 'mend') {
    const ally = chooseLowestHpTarget(enemies)
    if (ally && ally.currentHp <= Math.ceil(ally.maxHp / 2)) {
      return { action: 'special', specialId: readySpecial.id, targetId: ally.id }
    }
  }

  if (readySpecial.type === 'strike' && (target.currentHp <= readySpecial.value || Math.random() < 0.2)) {
    return { action: 'special', specialId: readySpecial.id, targetId: target.id }
  }

  return { action: 'attack', targetId: target.id }
}

function attachEnemyIntents(enemies: Creature[], team: Creature[]): Creature[] {
  const livingEnemies = getLivingCreatures(enemies)
  return enemies.map((enemy) => {
    if (enemy.currentHp <= 0) {
      return {
        ...enemy,
        intent: undefined,
      }
    }

    return {
      ...enemy,
      intent: chooseEnemyIntent(enemy, livingEnemies, team),
    }
  })
}

function moveToEncounter(encounterIndex: number, roster: Creature[], stats: GameState['stats']): GameState {
  const encounter = getEncounter(encounterIndex)
  const livingCount = getLivingCreatures(roster).length

  if (!encounter) {
    return {
      ...initialState,
      phase: 'victory',
      roster,
      stats,
    }
  }

  if (encounter.type !== 'recruit' && encounter.type !== 'rest' && livingCount === 0) {
    return {
      ...initialState,
      phase: 'defeat',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      stats,
      lastEffect: createEffect(stats.fightsWon + stats.boostsGiven + stats.encountersCleared + 1, {
        kind: 'defeat',
        targetIds: [],
        label: 'Lost',
        sound: 'defeat',
      }),
    }
  }

  if (encounter.type === 'recruit') {
    return {
      ...initialState,
      phase: 'recruit',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      recruitOffer: createRecruitOffer(roster),
      stats,
    }
  }

  if (encounter.type === 'rest') {
    return {
      ...initialState,
      phase: 'rest',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      stats,
    }
  }

  return {
    ...initialState,
    phase: 'teamSelect',
    roster,
    encounterIndex,
    encounterText: encounter.text,
    availableCreatureIds: createAvailableCreatureIds(roster),
    rewardTier: encounter.rewardTier ?? 'normal',
    stats,
  }
}

function applyRewardToRoster(
  roster: Creature[],
  creatureId: string,
  reward: RewardType,
  learnOffers: GameState['learnOffers'],
): Creature[] {
  if (reward.type === 'hp') {
    return updateCreatureList(roster, creatureId, (creature) => {
      const nextMaxHp = creature.maxHp + 2
      return {
        ...creature,
        maxHp: nextMaxHp,
        currentHp: Math.min(nextMaxHp, creature.currentHp + 2),
      }
    })
  }

  if (reward.type === 'atk') {
    return updateCreatureList(roster, creatureId, (creature) => ({
      ...creature,
      attack: creature.attack + 1,
    }))
  }

  if (reward.type === 'learn') {
    return updateCreatureList(roster, creatureId, (creature) => {
      const offer = learnOffers[creatureId]
      if (!offer || offer.id !== reward.specialId || creature.specials.length >= 2) {
        return creature
      }

      return {
        ...creature,
        specials: [...creature.specials, { ...offer, currentCooldown: 0 }],
      }
    })
  }

  if (reward.type === 'upgradeValue') {
    return updateCreatureList(roster, creatureId, (creature) => ({
      ...creature,
      specials: creature.specials.map((special) =>
        special.id === reward.specialId ? { ...special, value: special.value + 2 } : special,
      ),
    }))
  }

  return updateCreatureList(roster, creatureId, (creature) => ({
    ...creature,
    specials: creature.specials.map((special) =>
      special.id === reward.specialId
        ? { ...special, cooldown: Math.max(1, special.cooldown - 1) }
        : special,
    ),
  }))
}

function resolvePlayerAttack(state: GameState, actor: Creature, targetId: string): GameState {
  const target = state.enemies.find((enemy) => enemy.id === targetId && enemy.currentHp > 0)
  if (!target) {
    return state
  }

  const rallyBonus = actor.rallied
  const resolvedTarget = applyDamage(target, actor.attack + rallyBonus)
  const roster = updateCreatureList(state.roster, actor.id, (creature) => ({
    ...creature,
    rallied: 0,
  }))
  const enemies = updateCreatureList(state.enemies, target.id, () => resolvedTarget.creature)

  let combatLog = pushLog(
    state.combatLog,
    `${actor.name} attacks ${target.name} for ${resolvedTarget.damage} damage.`,
  )

  if (resolvedTarget.blocked > 0) {
    combatLog = pushLog(combatLog, `${target.name} blocks ${resolvedTarget.blocked} damage.`)
  }

  if (resolvedTarget.bonus > 0) {
    combatLog = pushLog(combatLog, `${target.name}'s weakness adds ${resolvedTarget.bonus} bonus damage.`)
  }

  if (resolvedTarget.creature.currentHp <= 0) {
    combatLog = pushLog(combatLog, `${target.name} falls quiet.`)
  }

  const livingEnemies = getLivingCreatures(enemies)

  if (livingEnemies.length === 0) {
    const encounter = getEncounter(state.encounterIndex)
    const nextStats = {
      ...state.stats,
      fightsWon: state.stats.fightsWon + 1,
      encountersCleared:
        encounter?.type === 'boss' ? ENCOUNTERS.length : state.stats.encountersCleared,
    }

    if (encounter?.type === 'boss') {
      return {
        ...state,
        phase: 'victory',
        roster,
        actedCreatureIds: [],
        enemies,
        combatLog: pushLog(combatLog, 'The Warden gives way to the tide.'),
        stats: nextStats,
        lastEffect: createEffect(state.stats.boostsGiven + nextStats.fightsWon + state.encounterIndex + 1, {
          kind: 'victory',
          targetIds: [],
          label: 'Victory',
          sound: 'victory',
          shake: true,
        }),
      }
    }

    return {
      ...state,
      phase: 'reward',
      roster,
        actedCreatureIds: [],
      enemies,
      combatLog: pushLog(combatLog, 'The path opens a little further.'),
      rewardTier: encounter?.rewardTier ?? 'normal',
      learnOffers: createLearnOffers(roster),
      stats: nextStats,
      lastEffect: createEffect(state.stats.boostsGiven + nextStats.fightsWon + state.encounterIndex + 1, {
        kind: 'damage',
        targetIds: [target.id],
        label: `-${resolvedTarget.damage}`,
        value: resolvedTarget.damage,
        sound: 'hit',
        shake: resolvedTarget.damage > 7,
      }),
    }
  }

  const actedCreatureIds = [...state.actedCreatureIds, actor.id]
  const remainingActors = getLivingCreatures(
    roster.filter(
      (creature) =>
        state.selectedTeamIds.includes(creature.id) && !actedCreatureIds.includes(creature.id),
    ),
  )

  return {
    ...state,
    roster,
    enemies,
    actedCreatureIds,
    combatLog,
    combatTurn: remainingActors.length > 0 ? 'player' : 'enemy',
    lastEffect: createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 1, {
      kind: 'damage',
      targetIds: [target.id],
      label: `-${resolvedTarget.damage}`,
      value: resolvedTarget.damage,
      sound: 'hit',
      shake: resolvedTarget.damage > 7,
    }),
  }
}

function resolvePlayerSpecial(
  state: GameState,
  actor: Creature,
  specialIndex: number,
  targetId: string,
): GameState {
  const special = actor.specials[specialIndex]
  if (!special || special.currentCooldown > 0) {
    return state
  }

  let roster = updateSpecial(state.roster, actor.id, specialIndex, (current) => ({
    ...current,
    currentCooldown: current.cooldown,
  }))
  let enemies = state.enemies
  let combatLog = state.combatLog
  let lastEffect: CombatEffect | null = null

  if (special.type === 'strike') {
    const target = state.enemies.find((enemy) => enemy.id === targetId && enemy.currentHp > 0)
    if (!target) {
      return state
    }

    const resolvedTarget = applyDamage(target, special.value)
    enemies = updateCreatureList(enemies, target.id, () => resolvedTarget.creature)
    combatLog = pushLog(combatLog, `${actor.name} uses ${special.name} on ${target.name}.`)
    if (resolvedTarget.bonus > 0) {
      combatLog = pushLog(combatLog, `${target.name}'s weakness adds ${resolvedTarget.bonus} bonus damage.`)
    }
    if (resolvedTarget.creature.currentHp <= 0) {
      combatLog = pushLog(combatLog, `${target.name} is driven back into the mist.`)
    }
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'damage',
      targetIds: [target.id],
      label: `-${resolvedTarget.damage}`,
      value: resolvedTarget.damage,
      sound: 'special',
      shake: resolvedTarget.damage > 7,
    })
  }

  if (special.type === 'weaken') {
    const target = state.enemies.find((enemy) => enemy.id === targetId && enemy.currentHp > 0)
    if (!target) {
      return state
    }

    enemies = updateCreatureList(enemies, target.id, (creature) => ({
      ...creature,
      weakened: special.value,
    }))
    combatLog = pushLog(combatLog, `${actor.name} exposes ${target.name}. The next hit deals +${special.value}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Weaken +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  }

  if (special.type === 'guard') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      shield: special.value,
    }))
    combatLog = pushLog(combatLog, `${actor.name} shields ${target.name} for the next hit.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'shield',
      targetIds: [target.id],
      label: `Shield ${special.value}`,
      value: special.value,
      sound: 'guard',
    })
  }

  if (special.type === 'mend') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      currentHp: Math.min(creature.maxHp, creature.currentHp + special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} restores ${special.value} HP to ${target.name}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'heal',
      targetIds: [target.id],
      label: `+${special.value}`,
      value: special.value,
      sound: 'heal',
    })
  }

  if (special.type === 'rally') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      rallied: special.value,
    }))
    combatLog = pushLog(combatLog, `${actor.name} rallies ${target.name}. Their next attack gains +${special.value}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Rally +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  }

  const livingEnemies = getLivingCreatures(enemies)

  if (livingEnemies.length === 0) {
    const encounter = getEncounter(state.encounterIndex)
    const nextStats = {
      ...state.stats,
      fightsWon: state.stats.fightsWon + 1,
      encountersCleared:
        encounter?.type === 'boss' ? ENCOUNTERS.length : state.stats.encountersCleared,
    }

    if (encounter?.type === 'boss') {
      return {
        ...state,
        phase: 'victory',
        roster,
        actedCreatureIds: [],
        enemies,
        combatLog: pushLog(combatLog, 'The island exhales. The Warden yields.'),
        stats: nextStats,
        lastEffect:
          lastEffect ??
          createEffect(state.stats.boostsGiven + nextStats.fightsWon + state.encounterIndex + 2, {
            kind: 'victory',
            targetIds: [],
            label: 'Victory',
            sound: 'victory',
            shake: true,
          }),
      }
    }

    return {
      ...state,
      phase: 'reward',
      roster,
      actedCreatureIds: [],
      enemies,
      combatLog: pushLog(combatLog, 'The current lets you breathe again.'),
      rewardTier: encounter?.rewardTier ?? 'normal',
      learnOffers: createLearnOffers(roster),
      stats: nextStats,
      lastEffect: lastEffect,
    }
  }

  const actedCreatureIds = [...state.actedCreatureIds, actor.id]
  const remainingActors = getLivingCreatures(
    roster.filter(
      (creature) =>
        state.selectedTeamIds.includes(creature.id) && !actedCreatureIds.includes(creature.id),
    ),
  )

  return {
    ...state,
    roster,
    enemies,
    actedCreatureIds,
    combatLog,
    combatTurn: remainingActors.length > 0 ? 'player' : 'enemy',
    lastEffect,
  }
}

function executeEnemyTurn(state: GameState): GameState {
  let roster = state.roster
  let enemies = state.enemies
  let combatLog = state.combatLog
  let lastEffect = state.lastEffect

  const livingTeamAtStart = getLivingCreatures(
    roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
  )
  if (livingTeamAtStart.length === 0) {
    return {
      ...state,
      phase: 'defeat',
      lastEffect: createEffect(state.stats.encountersCleared + state.stats.fightsWon + 10, {
        kind: 'defeat',
        targetIds: [],
        label: 'Lost',
        sound: 'defeat',
      }),
    }
  }

  for (const actingEnemy of state.enemies) {
    const enemy = enemies.find((creature) => creature.id === actingEnemy.id)
    if (!enemy || enemy.currentHp <= 0) {
      continue
    }

    const livingTeam = getLivingCreatures(
      roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
    )
    if (livingTeam.length === 0) {
      break
    }

    const intent = enemy.intent ?? chooseEnemyIntent(enemy, getLivingCreatures(enemies), livingTeam)
    const fallbackTarget = chooseLowestHpTarget(livingTeam)
    const actualTargetId =
      livingTeam.find((creature) => creature.id === intent.targetId)?.id ?? fallbackTarget?.id ?? ''

    if (intent.action === 'attack') {
      const target = roster.find((creature) => creature.id === actualTargetId)
      if (!target) {
        continue
      }

      const resolved = applyDamage(target, enemy.attack)
      roster = updateCreatureList(roster, target.id, () => resolved.creature)
      combatLog = pushLog(combatLog, `${enemy.name} attacks ${target.name}.`)
      if (resolved.blocked > 0) {
        combatLog = pushLog(combatLog, `${target.name} blocks ${resolved.blocked} damage.`)
      }
      if (resolved.damage > 0) {
        combatLog = pushLog(combatLog, `${target.name} loses ${resolved.damage} HP.`)
      }
      if (resolved.creature.currentHp <= 0) {
        combatLog = pushLog(combatLog, `${target.name} can no longer answer the call.`)
      }
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 20, {
        kind: 'damage',
        targetIds: [target.id],
        label: `-${resolved.damage}`,
        value: resolved.damage,
        sound: 'hit',
        shake: resolved.damage > 7,
      })
      continue
    }

    const specialIndex = enemy.specials.findIndex((special) => special.id === intent.specialId)
    const special = enemy.specials[specialIndex]
    if (!special || special.currentCooldown > 0) {
      continue
    }

    enemies = updateSpecial(enemies, enemy.id, specialIndex, (current) => ({
      ...current,
      currentCooldown: current.cooldown,
    }))

    if (special.type === 'strike') {
      const target = roster.find((creature) => creature.id === actualTargetId)
      if (!target) {
        continue
      }

      const resolved = applyDamage(target, special.value)
      roster = updateCreatureList(roster, target.id, () => resolved.creature)
      combatLog = pushLog(combatLog, `${enemy.name} uses ${special.name} on ${target.name}.`)
      if (resolved.damage > 0) {
        combatLog = pushLog(combatLog, `${target.name} loses ${resolved.damage} HP.`)
      }
      if (resolved.creature.currentHp <= 0) {
        combatLog = pushLog(combatLog, `${target.name} falls still.`)
      }
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 21, {
        kind: 'damage',
        targetIds: [target.id],
        label: `-${resolved.damage}`,
        value: resolved.damage,
        sound: 'special',
        shake: resolved.damage > 7,
      })
      continue
    }

    if (special.type === 'guard') {
      const target = enemies.find((creature) => creature.id === actualTargetId) ?? enemy
      enemies = updateCreatureList(enemies, target.id, (creature) => ({
        ...creature,
        shield: special.value,
      }))
      combatLog = pushLog(combatLog, `${enemy.name} shields ${target.name}.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 22, {
        kind: 'shield',
        targetIds: [target.id],
        label: `Shield ${special.value}`,
        value: special.value,
        sound: 'guard',
      })
      continue
    }

    if (special.type === 'mend') {
      const target = enemies.find((creature) => creature.id === actualTargetId) ?? enemy
      enemies = updateCreatureList(enemies, target.id, (creature) => ({
        ...creature,
        currentHp: Math.min(creature.maxHp, creature.currentHp + special.value),
      }))
      combatLog = pushLog(combatLog, `${enemy.name} restores ${special.value} HP to ${target.name}.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 23, {
        kind: 'heal',
        targetIds: [target.id],
        label: `+${special.value}`,
        value: special.value,
        sound: 'heal',
      })
    }
  }

  const survivors = getLivingCreatures(roster.filter((creature) => state.selectedTeamIds.includes(creature.id)))
  if (survivors.length === 0) {
    return {
      ...state,
      phase: 'defeat',
      roster: decrementCooldowns(roster),
      enemies,
      combatTurn: 'player',
      combatLog: pushLog(combatLog, 'The run ends in the island hush.'),
      lastEffect:
        lastEffect ??
        createEffect(state.stats.encountersCleared + state.stats.fightsWon + 30, {
          kind: 'defeat',
          targetIds: [],
          label: 'Lost',
          sound: 'defeat',
        }),
    }
  }

  const tickedRoster = decrementCooldowns(roster)
  const tickedEnemies = decrementCooldowns(enemies)
  const nextEnemies = attachEnemyIntents(tickedEnemies, survivors)

  return {
    ...state,
    roster: tickedRoster,
    actedCreatureIds: [],
    enemies: nextEnemies,
    combatTurn: 'player',
    combatLog,
    lastEffect,
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_RUN': {
      const roster = STARTER_CREATURES.map((template) => instantiateCreature(template))
      return moveToEncounter(0, roster, initialStats)
    }

    case 'SELECT_TEAM': {
      const roster = prepareRosterForBattle(state.roster)
      const selectedTeamIds = action.ids.filter((id) =>
        state.availableCreatureIds.includes(id),
      )
      const enemies = attachEnemyIntents(
        createEnemyGroup(state.encounterIndex),
        roster.filter((creature) => selectedTeamIds.includes(creature.id)),
      )
      const enemyNames = enemies.map((enemy) => enemy.name).join(' and ')

      return {
        ...state,
        phase: 'combat',
        roster,
        selectedTeamIds,
        actedCreatureIds: [],
        enemies,
        combatLog: [state.encounterText, `${enemyNames} emerge from the hush.`],
        combatTurn: 'player',
        lastEffect: null,
      }
    }

    case 'PLAYER_ACTION': {
      if (state.phase !== 'combat' || state.combatTurn !== 'player') {
        return state
      }

      const actor = state.roster.find((creature) => creature.id === action.creatureId)
      if (!actor || actor.currentHp <= 0 || !state.selectedTeamIds.includes(actor.id)) {
        return state
      }
      if (state.actedCreatureIds.includes(actor.id)) {
        return state
      }

      if (action.action === 'attack') {
        const targetId = action.targetId ?? getLivingCreatures(state.enemies)[0]?.id
        return targetId ? resolvePlayerAttack(state, actor, targetId) : state
      }

      const specialIndex = action.specialIndex ?? 0
      const special = actor.specials[specialIndex]
      if (!special) {
        return state
      }

      const targetId =
        action.targetId ??
        (special.type === 'strike' || special.type === 'weaken'
          ? getLivingCreatures(state.enemies)[0]?.id
          : getLivingCreatures(state.roster.filter((creature) => state.selectedTeamIds.includes(creature.id)))[0]?.id)

      return targetId ? resolvePlayerSpecial(state, actor, specialIndex, targetId) : state
    }

    case 'ENEMY_TURN':
      return executeEnemyTurn(state)

    case 'APPLY_REWARD': {
      const nextRoster = applyRewardToRoster(state.roster, action.creatureId, action.reward, state.learnOffers)
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

      const healedRoster = state.roster.map((creature) => ({
        ...creature,
        currentHp: Math.min(creature.maxHp, creature.currentHp + 3),
      }))

      return {
        ...state,
        roster: [...healedRoster, recruit],
        stats: {
          ...state.stats,
          recruited: [...state.stats.recruited, recruit.name],
        },
        lastEffect: createEffect(state.stats.encountersCleared + state.stats.boostsGiven + 40, {
          kind: 'heal',
          targetIds: healedRoster.map((creature) => creature.id),
          label: '+3',
          value: 3,
          sound: 'heal',
        }),
      }
    }

    case 'SKIP_RECRUIT':
      return state

    case 'REST_AND_CONTINUE': {
      const restedRoster = state.roster.map((creature) => ({
        ...creature,
        currentHp: Math.min(creature.maxHp, creature.currentHp + Math.ceil(creature.maxHp * 0.4)),
      }))
      const nextStats = {
        ...state.stats,
        encountersCleared: state.stats.encountersCleared + 1,
      }

      return moveToEncounter(state.encounterIndex + 1, restedRoster, nextStats)
    }

    case 'NEXT_ENCOUNTER': {
      const nextStats = {
        ...state.stats,
        encountersCleared: state.stats.encountersCleared + 1,
      }
      return moveToEncounter(state.encounterIndex + 1, state.roster, nextStats)
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

export function getIntentLabel(creature: Creature, enemyTeam: Creature[], playerTeam: Creature[]) {
  if (!creature.intent) {
    return 'Waiting'
  }

  const targetPool = creature.intent.action === 'attack' ? playerTeam : [...enemyTeam, ...playerTeam]
  const target = targetPool.find((candidate) => candidate.id === creature.intent?.targetId)

  if (creature.intent.action === 'attack') {
    return `Intent: attack ${target?.name ?? 'target'}`
  }

  const special = creature.specials.find((entry) => entry.id === creature.intent?.specialId)
  return `Intent: ${special?.name ?? 'special'} -> ${target?.name ?? 'target'}`
}
