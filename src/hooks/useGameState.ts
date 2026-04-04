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
  Element,
  GameAction,
  GameState,
  RewardType,
  SpecialState,
  SpecialTemplate,
} from '../types'

const MAX_LOG_LINES = 10
const POISON_DURATION = 3
const CHARGE_EXPOSURE_BONUS = 2

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
  learnOffers: [],
  stats: initialStats,
  lastEffect: null,
}

const ELEMENT_ADVANTAGE: Record<Exclude<Element, 'shadow'>, Exclude<Element, 'shadow'>> = {
  fire: 'nature',
  nature: 'water',
  water: 'fire',
}

type DamagePayload = {
  physical?: number
  elemental?: number
  element?: Element
}

type DamageResult = {
  creature: Creature
  damage: number
  blocked: number
  bonus: number
  chargeBonus: number
  physicalDamage: number
  elementalDamage: number
  element?: Element
  elementOutcome: 'neutral' | 'advantage' | 'resist'
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

function decrementTimedStates(creatures: Creature[]): Creature[] {
  return creatures.map((creature) => ({
    ...creature,
    tauntTurns: Math.max(0, creature.tauntTurns - 1),
  }))
}

function prepareRosterForBattle(roster: Creature[]): Creature[] {
  return roster.map((creature) => ({
    ...creature,
    shield: 0,
    weakened: 0,
    rallied: 0,
    poison: 0,
    poisonTurns: 0,
    tauntTurns: 0,
    charging: undefined,
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
  return getLivingCreatures(roster).map((creature) => creature.id)
}

function createLearnOffers(roster: Creature[]): SpecialTemplate[] {
  const eligibleCreatures = roster.filter(
    (creature) => creature.role !== 'boss' && creature.currentHp > 0 && creature.specials.length < 2,
  )
  if (eligibleCreatures.length === 0) {
    return []
  }

  return shuffle(LEARNABLE_ABILITIES)
    .filter((special) =>
      eligibleCreatures.some((creature) => creature.specials.every((known) => known.id !== special.id)),
    )
    .slice(0, 3)
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

function getElementOutcome(attackingElement: Element | undefined, targetElement: Element): DamageResult['elementOutcome'] {
  if (!attackingElement || attackingElement === 'shadow' || targetElement === 'shadow') {
    return 'neutral'
  }

  if (ELEMENT_ADVANTAGE[attackingElement] === targetElement) {
    return 'advantage'
  }

  if (ELEMENT_ADVANTAGE[targetElement as Exclude<Element, 'shadow'>] === attackingElement) {
    return 'resist'
  }

  return 'neutral'
}

function scaleElementalDamage(amount: number, outcome: DamageResult['elementOutcome']) {
  if (outcome === 'advantage') {
    return amount * 2
  }
  if (outcome === 'resist') {
    return Math.floor(amount / 2)
  }
  return amount
}

function applyDamage(target: Creature, payload: DamagePayload): DamageResult {
  const weakenedResult = consumeWeaken(target)
  const physicalDamage = payload.physical ?? 0
  const rawElementalDamage = payload.elemental ?? 0
  const elementOutcome = getElementOutcome(payload.element, target.element)
  const elementalDamage = scaleElementalDamage(rawElementalDamage, elementOutcome)
  const chargeBonus = weakenedResult.nextTarget.charging ? CHARGE_EXPOSURE_BONUS : 0
  const totalDamage = physicalDamage + elementalDamage + weakenedResult.bonus + chargeBonus

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
      chargeBonus,
      physicalDamage,
      elementalDamage,
      element: payload.element,
      elementOutcome,
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
    chargeBonus,
    physicalDamage,
    elementalDamage,
    element: payload.element,
    elementOutcome,
  }
}

function buildDamageBreakdown(result: DamageResult) {
  const parts: string[] = []

  if (result.physicalDamage > 0) {
    parts.push(`${result.physicalDamage} physical`)
  }
  if (result.elementalDamage > 0 && result.element) {
    let elemental = `${result.elementalDamage} ${getElementLabel(result.element).toLowerCase()}`
    if (result.elementOutcome === 'advantage') {
      elemental += ' (super effective)'
    } else if (result.elementOutcome === 'resist') {
      elemental += ' (resisted)'
    }
    parts.push(elemental)
  }
  if (result.bonus > 0) {
    parts.push(`${result.bonus} weakness`)
  }
  if (result.chargeBonus > 0) {
    parts.push(`${result.chargeBonus} exposed`)
  }

  return parts.join(' + ')
}

function chooseLowestHpTarget(creatures: Creature[]): Creature | null {
  return (
    [...creatures]
      .filter((creature) => creature.currentHp > 0)
      .sort((left, right) => left.currentHp - right.currentHp)[0] ?? null
  )
}

function getTauntingTargets(creatures: Creature[]) {
  return creatures.filter((creature) => creature.currentHp > 0 && creature.tauntTurns > 0)
}

function chooseEnemyAttackTarget(team: Creature[]): Creature | null {
  const livingTeam = team.filter((creature) => creature.currentHp > 0)
  if (livingTeam.length === 0) {
    return null
  }

  const tauntingTargets = getTauntingTargets(livingTeam)
  if (tauntingTargets.length > 0) {
    return chooseLowestHpTarget(tauntingTargets) ?? tauntingTargets[0] ?? null
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

function chooseSpecial(enemy: Creature, predicate: (special: SpecialState) => boolean) {
  return enemy.specials.find((special) => special.currentCooldown === 0 && predicate(special))
}

function createSpecialIntent(special: SpecialState, targetId: string): CombatIntent {
  if (special.chargeTurns && special.chargeTurns > 0) {
    return { action: 'charge', specialId: special.id, targetId }
  }

  return { action: 'special', specialId: special.id, targetId }
}

function chooseEnemyIntent(enemy: Creature, enemies: Creature[], team: Creature[]): CombatIntent {
  if (enemy.charging) {
    return { action: 'charge', targetId: enemy.charging.targetId, specialId: enemy.charging.specialId }
  }

  const livingEnemies = getLivingCreatures(enemies)
  const livingTeam = getLivingCreatures(team)
  const target = chooseEnemyAttackTarget(livingTeam) ?? livingTeam[0]

  if (!target) {
    return { action: 'attack', targetId: '' }
  }

  const lowAlly = chooseLowestHpTarget(livingEnemies)
  const allyWithoutShield = chooseLowestHpTarget(livingEnemies.filter((creature) => creature.shield === 0))
  const unpoisonedTarget = chooseLowestHpTarget(livingTeam.filter((creature) => creature.poisonTurns === 0)) ?? target
  const unweakenedTarget = chooseLowestHpTarget(livingTeam.filter((creature) => creature.weakened === 0)) ?? target

  switch (enemy.behavior) {
    case 'berserker': {
      const rally = chooseSpecial(enemy, (special) => special.type === 'rally')
      if (rally && enemy.currentHp <= Math.ceil(enemy.maxHp / 2) && enemy.rallied === 0) {
        return { action: 'special', specialId: rally.id, targetId: enemy.id }
      }

      const chargedStrike = chooseSpecial(enemy, (special) => special.type === 'strike' && Boolean(special.chargeTurns))
      if (chargedStrike) {
        return createSpecialIntent(chargedStrike, target.id)
      }

      const strike = chooseSpecial(enemy, (special) => special.type === 'strike')
      if (strike && (target.currentHp <= strike.value || Math.random() < 0.3)) {
        return createSpecialIntent(strike, target.id)
      }
      break
    }

    case 'guardian': {
      const taunt = chooseSpecial(enemy, (special) => special.type === 'taunt')
      if (taunt && enemy.tauntTurns === 0) {
        return { action: 'special', specialId: taunt.id, targetId: enemy.id }
      }

      const guard = chooseSpecial(enemy, (special) => special.type === 'guard')
      if (guard && allyWithoutShield && allyWithoutShield.currentHp <= Math.ceil(allyWithoutShield.maxHp * 0.7)) {
        return { action: 'special', specialId: guard.id, targetId: allyWithoutShield.id }
      }
      break
    }

    case 'hexer': {
      const poison = chooseSpecial(enemy, (special) => special.type === 'poison')
      if (poison && unpoisonedTarget) {
        return { action: 'special', specialId: poison.id, targetId: unpoisonedTarget.id }
      }

      const weaken = chooseSpecial(enemy, (special) => special.type === 'weaken')
      if (weaken && unweakenedTarget) {
        return { action: 'special', specialId: weaken.id, targetId: unweakenedTarget.id }
      }

      const strike = chooseSpecial(enemy, (special) => special.type === 'strike')
      if (strike && Math.random() < 0.35) {
        return createSpecialIntent(strike, target.id)
      }
      break
    }

    case 'support': {
      const mend = chooseSpecial(enemy, (special) => special.type === 'mend')
      if (mend && lowAlly && lowAlly.currentHp <= Math.ceil(lowAlly.maxHp * 0.7)) {
        return { action: 'special', specialId: mend.id, targetId: lowAlly.id }
      }

      const weaken = chooseSpecial(enemy, (special) => special.type === 'weaken')
      if (weaken && unweakenedTarget) {
        return { action: 'special', specialId: weaken.id, targetId: unweakenedTarget.id }
      }
      break
    }

    case 'warden': {
      const eclipse = chooseSpecial(enemy, (special) => special.id === 'eclipse')
      if (eclipse) {
        return createSpecialIntent(eclipse, target.id)
      }

      const poison = chooseSpecial(enemy, (special) => special.type === 'poison')
      if (poison && unpoisonedTarget) {
        return { action: 'special', specialId: poison.id, targetId: unpoisonedTarget.id }
      }

      const strike = chooseSpecial(enemy, (special) => special.type === 'strike')
      if (strike) {
        return createSpecialIntent(strike, target.id)
      }
      break
    }

    default: {
      const guard = chooseSpecial(enemy, (special) => special.type === 'guard')
      if (guard && allyWithoutShield && allyWithoutShield.currentHp <= Math.ceil(allyWithoutShield.maxHp / 2)) {
        return { action: 'special', specialId: guard.id, targetId: allyWithoutShield.id }
      }

      const mend = chooseSpecial(enemy, (special) => special.type === 'mend')
      if (mend && lowAlly && lowAlly.currentHp <= Math.ceil(lowAlly.maxHp / 2)) {
        return { action: 'special', specialId: mend.id, targetId: lowAlly.id }
      }

      const strike = chooseSpecial(enemy, (special) => special.type === 'strike')
      if (strike && (target.currentHp <= strike.value || Math.random() < 0.2)) {
        return createSpecialIntent(strike, target.id)
      }
    }
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
      const offer = learnOffers.find((special) => special.id === reward.specialId)
      if (!offer || creature.specials.length >= 2 || creature.specials.some((special) => special.id === offer.id)) {
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

function advanceAfterWin(
  state: GameState,
  roster: Creature[],
  enemies: Creature[],
  combatLog: string[],
  lastEffect: CombatEffect | null,
): GameState {
  const encounter = getEncounter(state.encounterIndex)
  const nextStats = {
    ...state.stats,
    fightsWon: state.stats.fightsWon + 1,
    encountersCleared: encounter?.type === 'boss' ? ENCOUNTERS.length : state.stats.encountersCleared,
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
        createEffect(state.stats.boostsGiven + nextStats.fightsWon + state.encounterIndex + 1, {
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
    lastEffect,
  }
}

function finishPlayerAction(
  state: GameState,
  roster: Creature[],
  enemies: Creature[],
  combatLog: string[],
  actor: Creature,
  lastEffect: CombatEffect | null,
): GameState {
  if (getLivingCreatures(enemies).length === 0) {
    return advanceAfterWin(state, roster, enemies, combatLog, lastEffect)
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

function resolvePlayerAttack(state: GameState, actor: Creature, targetId: string): GameState {
  const tauntingEnemies = getTauntingTargets(getLivingCreatures(state.enemies))
  const actualTargetId = tauntingEnemies.length > 0 ? tauntingEnemies[0]!.id : targetId
  const target = state.enemies.find((enemy) => enemy.id === actualTargetId && enemy.currentHp > 0)
  if (!target) {
    return state
  }

  const rallyBonus = actor.rallied
  const resolvedTarget = applyDamage(target, {
    physical: actor.attack + rallyBonus,
    elemental: actor.elementalAttack,
    element: actor.element,
  })
  const roster = updateCreatureList(state.roster, actor.id, (creature) => ({
    ...creature,
    rallied: 0,
  }))
  const enemies = updateCreatureList(state.enemies, target.id, () => resolvedTarget.creature)
  const breakdown = buildDamageBreakdown(resolvedTarget)

  let combatLog = pushLog(
    state.combatLog,
    `${actor.name} attacks ${target.name} for ${resolvedTarget.damage} damage${breakdown ? ` (${breakdown})` : ''}.`,
  )

  if (resolvedTarget.blocked > 0) {
    combatLog = pushLog(combatLog, `${target.name} blocks ${resolvedTarget.blocked} damage.`)
  }

  if (resolvedTarget.creature.currentHp <= 0) {
    combatLog = pushLog(combatLog, `${target.name} falls quiet.`)
  }

  return finishPlayerAction(
    state,
    roster,
    enemies,
    combatLog,
    actor,
    createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 1, {
      kind: 'damage',
      targetIds: [target.id],
      label: `-${resolvedTarget.damage}`,
      value: resolvedTarget.damage,
      sound: 'hit',
      shake: resolvedTarget.damage > 7,
    }),
  )
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
    const targets =
      special.targetScope === 'all'
        ? getLivingCreatures(state.enemies)
        : state.enemies.filter((enemy) => enemy.id === targetId && enemy.currentHp > 0)
    if (targets.length === 0) {
      return state
    }

    const updatedTargets: string[] = []
    let totalDamage = 0
    for (const target of targets) {
      const resolvedTarget = applyDamage(target, {
        elemental: special.value,
        element: special.element ?? actor.element,
      })
      enemies = updateCreatureList(enemies, target.id, () => resolvedTarget.creature)
      updatedTargets.push(target.id)
      totalDamage += resolvedTarget.damage
      const breakdown = buildDamageBreakdown(resolvedTarget)
      combatLog = pushLog(
        combatLog,
        `${actor.name} uses ${special.name} on ${target.name} for ${resolvedTarget.damage}${breakdown ? ` (${breakdown})` : ''}.`,
      )
      if (resolvedTarget.blocked > 0) {
        combatLog = pushLog(combatLog, `${target.name} blocks ${resolvedTarget.blocked} damage.`)
      }
      if (resolvedTarget.creature.currentHp <= 0) {
        combatLog = pushLog(combatLog, `${target.name} is driven back into the mist.`)
      }
    }

    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'damage',
      targetIds: updatedTargets,
      label: `-${totalDamage}`,
      value: totalDamage,
      sound: 'special',
      shake: totalDamage > 7,
    })
  } else if (special.type === 'weaken') {
    const target = state.enemies.find((enemy) => enemy.id === targetId && enemy.currentHp > 0)
    if (!target) {
      return state
    }

    enemies = updateCreatureList(enemies, target.id, (creature) => ({
      ...creature,
      weakened: Math.max(creature.weakened, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} exposes ${target.name}. The next hit deals +${special.value}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Weaken +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  } else if (special.type === 'guard') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      shield: Math.max(creature.shield, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} shields ${target.name} for the next hit.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'shield',
      targetIds: [target.id],
      label: `Shield ${special.value}`,
      value: special.value,
      sound: 'guard',
    })
  } else if (special.type === 'mend') {
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
  } else if (special.type === 'rally') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      rallied: Math.max(creature.rallied, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} rallies ${target.name}. Their next attack gains +${special.value}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Rally +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  } else if (special.type === 'poison') {
    const target = state.enemies.find((enemy) => enemy.id === targetId && enemy.currentHp > 0)
    if (!target) {
      return state
    }

    enemies = updateCreatureList(enemies, target.id, (creature) => ({
      ...creature,
      poison: Math.max(creature.poison, special.value),
      poisonTurns: Math.max(creature.poisonTurns, POISON_DURATION),
    }))
    combatLog = pushLog(combatLog, `${actor.name} poisons ${target.name}. The rot will bite for ${special.value}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Poison ${special.value}`,
      value: special.value,
      sound: 'special',
    })
  } else if (special.type === 'taunt') {
    const target = roster.find((creature) => creature.id === targetId && state.selectedTeamIds.includes(creature.id))
    if (!target || target.currentHp <= 0) {
      return state
    }

    roster = updateCreatureList(roster, target.id, (creature) => ({
      ...creature,
      tauntTurns: Math.max(creature.tauntTurns, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} draws the enemy's eye to ${target.name}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 2, {
      kind: 'buff',
      targetIds: [target.id],
      label: `Taunt ${special.value}`,
      value: special.value,
      sound: 'special',
    })
  }

  return finishPlayerAction(state, roster, enemies, combatLog, actor, lastEffect)
}

function applyPoisonTick(
  creatures: Creature[],
  creatureIds: string[],
  combatLog: string[],
  tickBase: number,
) {
  let nextCreatures = creatures
  let nextLog = combatLog
  const affectedIds: string[] = []
  let totalDamage = 0

  for (const creatureId of creatureIds) {
    const current = nextCreatures.find((creature) => creature.id === creatureId && creature.currentHp > 0)
    if (!current || current.poisonTurns <= 0 || current.poison <= 0) {
      continue
    }

    const damage = Math.min(current.currentHp, current.poison)
    const remainingTurns = Math.max(0, current.poisonTurns - 1)
    const nextCreature = {
      ...current,
      currentHp: Math.max(0, current.currentHp - damage),
      poisonTurns: remainingTurns,
      poison: remainingTurns === 0 ? 0 : current.poison,
    }

    nextCreatures = updateCreatureList(nextCreatures, current.id, () => nextCreature)
    nextLog = pushLog(nextLog, `${current.name} suffers ${damage} poison damage.`)
    if (nextCreature.currentHp <= 0) {
      nextLog = pushLog(nextLog, `${current.name} collapses under the rot.`)
    }
    affectedIds.push(current.id)
    totalDamage += damage
  }

  return {
    creatures: nextCreatures,
    combatLog: nextLog,
    lastEffect:
      affectedIds.length > 0
        ? createEffect(tickBase, {
            kind: 'damage',
            targetIds: affectedIds,
            label: `-${totalDamage}`,
            value: totalDamage,
            sound: 'special',
            shake: totalDamage > 6,
          })
        : null,
  }
}

function executeEnemyTurn(state: GameState): GameState {
  let roster = state.roster
  let enemies = state.enemies
  let combatLog = state.combatLog
  let lastEffect = state.lastEffect

  const poisonOnTeam = applyPoisonTick(
    roster,
    state.selectedTeamIds,
    combatLog,
    state.stats.encountersCleared + state.stats.fightsWon + 18,
  )
  roster = poisonOnTeam.creatures
  combatLog = poisonOnTeam.combatLog
  lastEffect = poisonOnTeam.lastEffect ?? lastEffect

  const livingTeamAtStart = getLivingCreatures(
    roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
  )
  if (livingTeamAtStart.length === 0) {
    return {
      ...state,
      phase: 'defeat',
      lastEffect:
        lastEffect ??
        createEffect(state.stats.encountersCleared + state.stats.fightsWon + 10, {
          kind: 'defeat',
          targetIds: [],
          label: 'Lost',
          sound: 'defeat',
        }),
      combatLog: pushLog(combatLog, 'The run ends in the island hush.'),
      roster,
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

    if (enemy.charging) {
      const specialIndex = enemy.specials.findIndex((special) => special.id === enemy.charging?.specialId)
      const special = enemy.specials[specialIndex]
      if (!special) {
        enemies = updateCreatureList(enemies, enemy.id, (creature) => ({ ...creature, charging: undefined }))
        continue
      }

      if (enemy.charging.turnsRemaining > 1) {
        enemies = updateCreatureList(enemies, enemy.id, (creature) => ({
          ...creature,
          charging: creature.charging
            ? { ...creature.charging, turnsRemaining: creature.charging.turnsRemaining - 1 }
            : undefined,
        }))
        combatLog = pushLog(
          combatLog,
          `${enemy.name} keeps charging ${special.name}. The air tightens around it.`,
        )
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 19, {
          kind: 'buff',
          targetIds: [enemy.id],
          label: 'Charging',
          sound: 'special',
        })
        continue
      }

      const chargeTargetId = enemy.charging.targetId
      const strikeTargets =
        special.targetScope === 'all'
          ? getLivingCreatures(roster.filter((creature) => state.selectedTeamIds.includes(creature.id)))
          : roster.filter((creature) => creature.id === chargeTargetId && creature.currentHp > 0)
      if (strikeTargets.length > 0) {
        let totalDamage = 0
        const hitIds: string[] = []
        for (const target of strikeTargets) {
          const resolved = applyDamage(target, {
            elemental: special.value,
            element: special.element ?? enemy.element,
          })
          roster = updateCreatureList(roster, target.id, () => resolved.creature)
          hitIds.push(target.id)
          totalDamage += resolved.damage
          const breakdown = buildDamageBreakdown(resolved)
          combatLog = pushLog(
            combatLog,
            `${enemy.name} unleashes ${special.name} on ${target.name} for ${resolved.damage}${breakdown ? ` (${breakdown})` : ''}.`,
          )
          if (resolved.blocked > 0) {
            combatLog = pushLog(combatLog, `${target.name} blocks ${resolved.blocked} damage.`)
          }
          if (resolved.creature.currentHp <= 0) {
            combatLog = pushLog(combatLog, `${target.name} falls still.`)
          }
        }

        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 21, {
          kind: 'damage',
          targetIds: hitIds,
          label: `-${totalDamage}`,
          value: totalDamage,
          sound: 'special',
          shake: totalDamage > 7,
        })
      }

      enemies = updateCreatureList(enemies, enemy.id, (creature) => ({
        ...creature,
        charging: undefined,
        specials: creature.specials.map((entry, index) =>
          index === specialIndex ? { ...entry, currentCooldown: entry.cooldown } : entry,
        ),
      }))
      continue
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

      const resolved = applyDamage(target, {
        physical: enemy.attack + enemy.rallied,
        elemental: enemy.elementalAttack,
        element: enemy.element,
      })
      roster = updateCreatureList(roster, target.id, () => resolved.creature)
      enemies = updateCreatureList(enemies, enemy.id, (creature) => ({ ...creature, rallied: 0 }))
      const breakdown = buildDamageBreakdown(resolved)
      combatLog = pushLog(
        combatLog,
        `${enemy.name} attacks ${target.name} for ${resolved.damage}${breakdown ? ` (${breakdown})` : ''}.`,
      )
      if (resolved.blocked > 0) {
        combatLog = pushLog(combatLog, `${target.name} blocks ${resolved.blocked} damage.`)
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

    if (intent.action === 'charge') {
      enemies = updateCreatureList(enemies, enemy.id, (creature) => ({
        ...creature,
        charging: {
          specialId: special.id,
          targetId: actualTargetId,
          turnsRemaining: special.chargeTurns ?? 1,
        },
      }))
      combatLog = pushLog(
        combatLog,
        `${enemy.name} begins charging ${special.name}. Hit it now or weather the burst.`,
      )
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 19, {
        kind: 'buff',
        targetIds: [enemy.id],
        label: 'Charging',
        sound: 'special',
      })
      continue
    }

    enemies = updateSpecial(enemies, enemy.id, specialIndex, (current) => ({
      ...current,
      currentCooldown: current.cooldown,
    }))

    if (special.type === 'strike') {
      const targets =
        special.targetScope === 'all'
          ? getLivingCreatures(roster.filter((creature) => state.selectedTeamIds.includes(creature.id)))
          : roster.filter((creature) => creature.id === actualTargetId && creature.currentHp > 0)
      if (targets.length === 0) {
        continue
      }

      let totalDamage = 0
      const hitIds: string[] = []
      for (const target of targets) {
        const resolved = applyDamage(target, {
          elemental: special.value,
          element: special.element ?? enemy.element,
        })
        roster = updateCreatureList(roster, target.id, () => resolved.creature)
        hitIds.push(target.id)
        totalDamage += resolved.damage
        const breakdown = buildDamageBreakdown(resolved)
        combatLog = pushLog(
          combatLog,
          `${enemy.name} uses ${special.name} on ${target.name} for ${resolved.damage}${breakdown ? ` (${breakdown})` : ''}.`,
        )
        if (resolved.blocked > 0) {
          combatLog = pushLog(combatLog, `${target.name} blocks ${resolved.blocked} damage.`)
        }
        if (resolved.creature.currentHp <= 0) {
          combatLog = pushLog(combatLog, `${target.name} falls still.`)
        }
      }
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 21, {
        kind: 'damage',
        targetIds: hitIds,
        label: `-${totalDamage}`,
        value: totalDamage,
        sound: 'special',
        shake: totalDamage > 7,
      })
      continue
    }

    if (special.type === 'guard') {
      const target = enemies.find((creature) => creature.id === actualTargetId) ?? enemy
      enemies = updateCreatureList(enemies, target.id, (creature) => ({
        ...creature,
        shield: Math.max(creature.shield, special.value),
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
      continue
    }

    if (special.type === 'weaken') {
      const target = roster.find((creature) => creature.id === actualTargetId)
      if (!target) {
        continue
      }
      roster = updateCreatureList(roster, target.id, (creature) => ({
        ...creature,
        weakened: Math.max(creature.weakened, special.value),
      }))
      combatLog = pushLog(combatLog, `${enemy.name} leaves ${target.name} exposed.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 24, {
        kind: 'buff',
        targetIds: [target.id],
        label: `Weaken +${special.value}`,
        value: special.value,
        sound: 'special',
      })
      continue
    }

    if (special.type === 'rally') {
      const target = enemies.find((creature) => creature.id === actualTargetId) ?? enemy
      enemies = updateCreatureList(enemies, target.id, (creature) => ({
        ...creature,
        rallied: Math.max(creature.rallied, special.value),
      }))
      combatLog = pushLog(combatLog, `${enemy.name} rallies ${target.name}.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 25, {
        kind: 'buff',
        targetIds: [target.id],
        label: `Rally +${special.value}`,
        value: special.value,
        sound: 'special',
      })
      continue
    }

    if (special.type === 'poison') {
      const target = roster.find((creature) => creature.id === actualTargetId)
      if (!target) {
        continue
      }
      roster = updateCreatureList(roster, target.id, (creature) => ({
        ...creature,
        poison: Math.max(creature.poison, special.value),
        poisonTurns: Math.max(creature.poisonTurns, POISON_DURATION),
      }))
      combatLog = pushLog(combatLog, `${enemy.name} poisons ${target.name}.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 26, {
        kind: 'buff',
        targetIds: [target.id],
        label: `Poison ${special.value}`,
        value: special.value,
        sound: 'special',
      })
      continue
    }

    if (special.type === 'taunt') {
      const target = enemies.find((creature) => creature.id === actualTargetId) ?? enemy
      enemies = updateCreatureList(enemies, target.id, (creature) => ({
        ...creature,
        tauntTurns: Math.max(creature.tauntTurns, special.value),
      }))
      combatLog = pushLog(combatLog, `${enemy.name} forces the line to answer it first.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 27, {
        kind: 'buff',
        targetIds: [target.id],
        label: `Taunt ${special.value}`,
        value: special.value,
        sound: 'special',
      })
    }
  }

  const survivors = getLivingCreatures(roster.filter((creature) => state.selectedTeamIds.includes(creature.id)))
  if (survivors.length === 0) {
    return {
      ...state,
      phase: 'defeat',
      roster: decrementCooldowns(decrementTimedStates(roster)),
      enemies: decrementTimedStates(enemies),
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

  const poisonOnEnemies = applyPoisonTick(
    enemies,
    enemies.map((creature) => creature.id),
    combatLog,
    state.stats.encountersCleared + state.stats.fightsWon + 28,
  )
  enemies = poisonOnEnemies.creatures
  combatLog = poisonOnEnemies.combatLog
  lastEffect = poisonOnEnemies.lastEffect ?? lastEffect

  if (getLivingCreatures(enemies).length === 0) {
    return advanceAfterWin(state, roster, enemies, combatLog, lastEffect)
  }

  const tickedRoster = decrementCooldowns(decrementTimedStates(roster))
  const tickedEnemies = decrementCooldowns(decrementTimedStates(enemies))
  const refreshedTeam = getLivingCreatures(
    tickedRoster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
  )
  const nextEnemies = attachEnemyIntents(tickedEnemies, refreshedTeam)

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
      const selectedTeamIds = action.ids.filter((id) => state.availableCreatureIds.includes(id))
      const selectedTeam = roster.filter((creature) => selectedTeamIds.includes(creature.id))
      const enemies = attachEnemyIntents(createEnemyGroup(state.encounterIndex), selectedTeam)
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
        const tauntingEnemies = getTauntingTargets(getLivingCreatures(state.enemies))
        const targetId =
          tauntingEnemies[0]?.id ?? action.targetId ?? getLivingCreatures(state.enemies)[0]?.id
        return targetId ? resolvePlayerAttack(state, actor, targetId) : state
      }

      const specialIndex = action.specialIndex ?? 0
      const special = actor.specials[specialIndex]
      if (!special) {
        return state
      }

      const defaultEnemyTarget = getLivingCreatures(state.enemies)[0]?.id
      const defaultAllyTarget = getLivingCreatures(
        state.roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
      )[0]?.id
      const targetId =
        action.targetId ??
        (special.targetType === 'ally' || special.targetType === 'self' || special.type === 'guard' || special.type === 'mend' || special.type === 'rally'
          ? defaultAllyTarget
          : defaultEnemyTarget)

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
        currentHp:
          creature.currentHp > 0 ? Math.min(creature.maxHp, creature.currentHp + 3) : creature.currentHp,
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
        currentHp:
          creature.currentHp > 0
            ? Math.min(creature.maxHp, creature.currentHp + Math.ceil(creature.maxHp * 0.4))
            : creature.currentHp,
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

export function getElementLabel(element: Element) {
  switch (element) {
    case 'fire':
      return 'Fire'
    case 'water':
      return 'Water'
    case 'nature':
      return 'Nature'
    case 'shadow':
      return 'Shadow'
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
  const special = creature.specials.find((entry) => entry.id === creature.intent?.specialId)

  if (creature.intent.action === 'attack') {
    return `Intent: attack ${target?.name ?? 'target'}`
  }

  if (creature.intent.action === 'charge') {
    const targetLabel = special?.targetScope === 'all' ? 'all foes' : target?.name ?? 'target'
    const turns = creature.charging?.turnsRemaining ?? special?.chargeTurns ?? 1
    return `Intent: charging ${special?.name ?? 'special'} -> ${targetLabel} (${turns})`
  }

  return `Intent: ${special?.name ?? 'special'} -> ${target?.name ?? 'target'}`
}
