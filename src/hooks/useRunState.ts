import { useMemo, useReducer } from 'react'

import { ARTIFACTS } from '../data/artifacts'
import { generateRunMap } from '../data/encounters'
import { EVENTS } from '../data/events'
import {
  ENEMY_GROUPS,
  LEARNABLE_ABILITIES,
  RECRUITABLE_CREATURES,
  STARTER_CREATURES,
  instantiateCreature,
} from '../data/creatures'
import type {
  ArtifactDefinition,
  CombatEffect,
  CombatIntent,
  Creature,
  Element,
  EncounterDefinition,
  EventDefinition,
  GameAction,
  GameState,
  RewardType,
  SpecialState,
  SpecialTemplate,
} from '../types'

const MAX_LOG_LINES = 10
const POISON_DURATION = 3
const CHARGE_EXPOSURE_BONUS = 10
const DAMAGE_VARIANCE_FLOOR = 0.85
const DAMAGE_VARIANCE_CEILING = 1
const LARGE_HIT_SHAKE_THRESHOLD = 35

const initialStats: GameState['stats'] = {
  fightsWon: 0,
  boostsGiven: 0,
  recruited: [],
  encountersCleared: 0,
}

const initialState: GameState = {
  phase: 'title',
  roster: [],
  runMap: [],
  availableCreatureIds: [],
  selectedTeamIds: [],
  activeCreatureId: null,
  enemies: [],
  enemyQueueIndex: 0,
  encounterIndex: 0,
  combatLog: [],
  encounterText: '',
  recruitOffer: [],
  pathOptions: [],
  currentEncounter: null,
  currentEventId: null,
  combatTurn: 'player',
  freeSwitch: false,
  switchesUsedThisFight: 0,
  rewardTier: 'normal',
  learnOffers: [],
  artifactOffers: [],
  artifacts: [],
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
  baseDamage: number
  blocked: number
  bonus: number
  chargeBonus: number
  physicalDamage: number
  elementalDamage: number
  element?: Element
  elementOutcome: 'neutral' | 'advantage' | 'resist'
  lastStandTriggered: boolean
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

function getLayer(runMap: GameState['runMap'], layerIndex: number) {
  return runMap[layerIndex]
}

function createResetState(runMap: GameState['runMap']) {
  return {
    ...initialState,
    runMap,
  }
}

function getLivingCreatures(creatures: Creature[]) {
  return creatures.filter((creature) => creature.currentHp > 0)
}

function pushLog(lines: string[], entry: string) {
  return [...lines, entry].slice(-MAX_LOG_LINES)
}

function createEffect(nextTick: number, effect: Omit<CombatEffect, 'tick'>): CombatEffect {
  return {
    tick: nextTick,
    ...effect,
  }
}

function updateCreatureList(
  creatures: Creature[],
  creatureId: string,
  updater: (creature: Creature) => Creature,
) {
  return creatures.map((creature) => (creature.id === creatureId ? updater(creature) : creature))
}

function updateSpecial(
  creatures: Creature[],
  creatureId: string,
  specialIndex: number,
  updater: (special: SpecialState) => SpecialState,
) {
  return updateCreatureList(creatures, creatureId, (creature) => ({
    ...creature,
    specials: creature.specials.map((special, index) =>
      index === specialIndex ? updater(special) : special,
    ),
  }))
}

function decrementCooldowns(creatures: Creature[]) {
  return creatures.map((creature) => ({
    ...creature,
    specials: creature.specials.map((special) => ({
      ...special,
      currentCooldown: Math.max(0, special.currentCooldown - 1),
    })),
  }))
}

function hasArtifact(artifacts: string[], artifactId: string) {
  return artifacts.includes(artifactId)
}

function prepareRosterForBattle(roster: Creature[], artifacts: string[]) {
  return roster.map((creature) => ({
    ...creature,
    shield: hasArtifact(artifacts, 'iron-shell') ? 15 : 0,
    weakened: 0,
    rallied: 0,
    poison: 0,
    poisonTurns: 0,
    intent: undefined,
    possibleIntents: undefined,
    charging: undefined,
    lastStandUsed: false,
    specials: creature.specials.map((special) => ({
      ...special,
      currentCooldown: 0,
    })),
  }))
}

function createEnemyQueue(encounter: EncounterDefinition | null) {
  const groupPool = encounter?.enemyGroupPool ?? []
  const groupId = encounter?.resolvedEnemyGroupId ?? sample(groupPool)
  const group = ENEMY_GROUPS[groupId] ?? []
  return group.map((template) => instantiateCreature(template))
}

function createRecruitOffer(roster: Creature[]) {
  const ownedIds = new Set(roster.map((creature) => creature.id))
  return shuffle(RECRUITABLE_CREATURES)
    .filter((template) => !ownedIds.has(template.id))
    .slice(0, 2)
    .map((template) => instantiateCreature(template))
}

function createAvailableCreatureIds(roster: Creature[]) {
  return getLivingCreatures(roster).map((creature) => creature.id)
}

function createLearnOffers(roster: Creature[]) {
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

function createArtifactOffers(ownedArtifactIds: string[]) {
  return shuffle(ARTIFACTS)
    .filter((artifact) => !ownedArtifactIds.includes(artifact.id))
    .slice(0, 2)
}

function getCurrentEnemy(enemies: Creature[], enemyQueueIndex: number) {
  return enemies[enemyQueueIndex] ?? null
}

function getActiveCreature(roster: Creature[], activeCreatureId: string | null) {
  if (!activeCreatureId) {
    return null
  }

  return roster.find((creature) => creature.id === activeCreatureId && creature.currentHp > 0) ?? null
}

function getBattleRoster(roster: Creature[], selectedTeamIds: string[]) {
  return roster.filter((creature) => selectedTeamIds.includes(creature.id))
}

function getEncounterOption(options: EncounterDefinition[], encounterId: string) {
  return options.find((option) => option.id === encounterId) ?? null
}

function getCurrentEvent(eventId: string | null): EventDefinition | null {
  return eventId ? EVENTS[eventId] ?? null : null
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

function getSpeed(artifacts: string[], creature: Creature) {
  return creature.speed + (hasArtifact(artifacts, 'deep-current') && creature.element === 'water' ? 2 : 0)
}

function getAttack(artifacts: string[], creature: Creature) {
  const rageBonus =
    hasArtifact(artifacts, 'burning-rage') && creature.currentHp > 0 && creature.currentHp <= Math.ceil(creature.maxHp * 0.3)
      ? 15
      : 0
  return creature.attack + rageBonus
}

function adjustDamagePayload(artifacts: string[], payload: DamagePayload) {
  return {
    ...payload,
    elemental:
      (payload.elemental ?? 0) +
      (payload.element === 'fire' && hasArtifact(artifacts, 'ember-ring') ? 15 : 0),
  }
}

function rollDamageVariance(base: number) {
  if (base <= 0) {
    return 0
  }

  const roll = DAMAGE_VARIANCE_FLOOR + Math.random() * (DAMAGE_VARIANCE_CEILING - DAMAGE_VARIANCE_FLOOR)
  return Math.max(1, Math.floor(base * roll))
}

function applyDamage(target: Creature, payload: DamagePayload, artifacts: string[], allowLastStand: boolean): DamageResult {
  const adjustedPayload = adjustDamagePayload(artifacts, payload)
  const weakenedResult = consumeWeaken(target)
  const physicalDamage = adjustedPayload.physical ?? 0
  const rawElementalDamage = adjustedPayload.elemental ?? 0
  const elementOutcome = getElementOutcome(adjustedPayload.element, target.element)
  const elementalDamage = scaleElementalDamage(rawElementalDamage, elementOutcome)
  const chargeBonus = weakenedResult.nextTarget.charging ? CHARGE_EXPOSURE_BONUS : 0
  const baseDamage = physicalDamage + elementalDamage + weakenedResult.bonus + chargeBonus
  const totalDamage = rollDamageVariance(baseDamage)

  const blocked = Math.min(weakenedResult.nextTarget.shield, totalDamage)
  const remainingDamage = Math.max(0, totalDamage - weakenedResult.nextTarget.shield)
  const wouldDie = remainingDamage >= weakenedResult.nextTarget.currentHp
  const canLastStand =
    allowLastStand &&
    hasArtifact(artifacts, 'last-stand') &&
    !weakenedResult.nextTarget.lastStandUsed &&
    wouldDie

  const nextHp = canLastStand
    ? 1
    : Math.max(0, weakenedResult.nextTarget.currentHp - remainingDamage)

  return {
    creature: {
      ...weakenedResult.nextTarget,
      shield: 0,
      currentHp: nextHp,
      lastStandUsed: weakenedResult.nextTarget.lastStandUsed || canLastStand,
    },
    damage: canLastStand ? Math.max(0, weakenedResult.nextTarget.currentHp - 1) : remainingDamage,
    baseDamage,
    blocked,
    bonus: weakenedResult.bonus,
    chargeBonus,
    physicalDamage,
    elementalDamage,
    element: adjustedPayload.element,
    elementOutcome,
    lastStandTriggered: canLastStand,
  }
}

function buildDamageBreakdown(result: DamageResult) {
  const parts: string[] = []

  parts.push(`${result.damage} rolled (base ${result.baseDamage})`)

  if (result.physicalDamage > 0) {
    parts.push(`${result.physicalDamage} physical`)
  }
  if (result.elementalDamage > 0 && result.element) {
    let elemental = `${result.elementalDamage} ${result.element}`
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

function pushUniqueIntent(intents: CombatIntent[], intent: CombatIntent | null) {
  if (!intent) {
    return intents
  }

  const exists = intents.some(
    (candidate) =>
      candidate.action === intent.action &&
      candidate.specialId === intent.specialId &&
      candidate.targetId === intent.targetId,
  )

  return exists ? intents : [...intents, intent]
}

function generatePossibleIntents(enemy: Creature): CombatIntent[] {
  if (enemy.charging) {
    return [{ action: 'charge', targetId: '', specialId: enemy.charging.specialId }]
  }

  const readyStrike = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'strike')
  const readyRally = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'rally')
  const readyGuard = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'guard')
  const readyMend = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'mend')
  const readyPoison = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'poison')
  const readyWeaken = enemy.specials.find((special) => special.currentCooldown === 0 && special.type === 'weaken')
  const attackIntent: CombatIntent = { action: 'attack', targetId: '' }
  let intents: CombatIntent[] = []

  switch (enemy.behavior) {
    case 'berserker':
      if (readyRally && enemy.currentHp <= Math.ceil(enemy.maxHp / 2) && enemy.rallied === 0) {
        intents = pushUniqueIntent(intents, { action: 'special', targetId: enemy.id, specialId: readyRally.id })
      }
      if (readyStrike?.chargeTurns) {
        intents = pushUniqueIntent(intents, { action: 'charge', targetId: '', specialId: readyStrike.id })
      } else if (readyStrike) {
        intents = pushUniqueIntent(intents, { action: 'special', targetId: '', specialId: readyStrike.id })
      }
      intents = pushUniqueIntent(intents, attackIntent)
      break
    case 'guardian':
      if (readyGuard && enemy.shield === 0) {
        intents = pushUniqueIntent(intents, { action: 'special', targetId: enemy.id, specialId: readyGuard.id })
      }
      intents = pushUniqueIntent(intents, readyWeaken ? { action: 'special', targetId: '', specialId: readyWeaken.id } : null)
      intents = pushUniqueIntent(intents, attackIntent)
      break
    case 'hexer':
      if (readyPoison && enemy.poisonTurns === 0) {
        intents = pushUniqueIntent(intents, { action: 'special', targetId: '', specialId: readyPoison.id })
      }
      intents = pushUniqueIntent(intents, readyWeaken ? { action: 'special', targetId: '', specialId: readyWeaken.id } : null)
      intents = pushUniqueIntent(intents, readyStrike ? { action: 'special', targetId: '', specialId: readyStrike.id } : null)
      intents = pushUniqueIntent(intents, attackIntent)
      break
    case 'support':
      if (readyMend && enemy.currentHp <= Math.ceil(enemy.maxHp * 0.65)) {
        intents = pushUniqueIntent(intents, { action: 'special', targetId: enemy.id, specialId: readyMend.id })
      }
      intents = pushUniqueIntent(intents, readyWeaken ? { action: 'special', targetId: '', specialId: readyWeaken.id } : null)
      intents = pushUniqueIntent(intents, attackIntent)
      break
    case 'warden':
      if (readyStrike?.id === 'eclipse') {
        intents = pushUniqueIntent(intents, { action: 'charge', targetId: '', specialId: readyStrike.id })
      }
      intents = pushUniqueIntent(intents, readyPoison ? { action: 'special', targetId: '', specialId: readyPoison.id } : null)
      intents = pushUniqueIntent(
        intents,
        readyStrike && readyStrike.id !== 'eclipse' ? { action: 'special', targetId: '', specialId: readyStrike.id } : null,
      )
      intents = pushUniqueIntent(intents, attackIntent)
      break
    default:
      intents = pushUniqueIntent(intents, attackIntent)
      break
  }

  return intents.slice(0, 3)
}

function resolveEnemyIntent(possibleIntents: CombatIntent[]): CombatIntent {
  const [first, second, third] = possibleIntents

  if (!second) {
    return first ?? { action: 'attack', targetId: '' }
  }

  const roll = Math.random()
  if (!third) {
    return roll < 0.65 ? first! : second
  }

  if (roll < 0.5) {
    return first!
  }
  if (roll < 0.8) {
    return second
  }

  return third
}

function attachCurrentEnemyIntent(state: GameState): GameState {
  const currentEnemy = getCurrentEnemy(state.enemies, state.enemyQueueIndex)
  if (!currentEnemy) {
    return state
  }

  return {
    ...state,
    enemies: state.enemies.map((enemy, index) =>
      index === state.enemyQueueIndex
        ? {
            ...enemy,
            intent: undefined,
            possibleIntents: generatePossibleIntents(enemy),
          }
        : {
            ...enemy,
            intent: undefined,
            possibleIntents: undefined,
          },
    ),
  }
}

function healCreaturePercent(creature: Creature, amount: number) {
  if (creature.currentHp <= 0) {
    return creature
  }

  return {
    ...creature,
    currentHp: Math.min(creature.maxHp, creature.currentHp + Math.ceil(creature.maxHp * amount)),
  }
}

function moveToEncounter(
  encounterIndex: number,
  encounter: EncounterDefinition,
  roster: Creature[],
  stats: GameState['stats'],
  artifacts: string[],
  runMap: GameState['runMap'],
): GameState {
  if (encounter.type !== 'recruit' && encounter.type !== 'rest' && encounter.type !== 'event' && getLivingCreatures(roster).length === 0) {
    return {
      ...createResetState(runMap),
      phase: 'defeat',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      currentEncounter: encounter,
      artifacts,
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
      ...createResetState(runMap),
      phase: 'recruit',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      currentEncounter: encounter,
      recruitOffer: createRecruitOffer(roster),
      artifacts,
      stats,
    }
  }

  if (encounter.type === 'rest') {
    return {
      ...createResetState(runMap),
      phase: 'rest',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      currentEncounter: encounter,
      artifacts,
      stats,
    }
  }

  if (encounter.type === 'event') {
    return {
      ...createResetState(runMap),
      phase: 'event',
      roster,
      encounterIndex,
      encounterText: encounter.text,
      currentEncounter: encounter,
      currentEventId: encounter.eventId ?? null,
      artifacts,
      stats,
    }
  }

  return {
    ...createResetState(runMap),
    phase: 'teamSelect',
    roster,
    encounterIndex,
    encounterText: encounter.text,
    currentEncounter: encounter,
    availableCreatureIds: createAvailableCreatureIds(roster),
    rewardTier: encounter.rewardTier ?? 'normal',
    artifacts,
    stats,
  }
}

function moveToLayer(
  encounterIndex: number,
  roster: Creature[],
  stats: GameState['stats'],
  artifacts: string[],
  runMap: GameState['runMap'],
): GameState {
  const layer = getLayer(runMap, encounterIndex)

  if (!layer) {
    return {
      ...createResetState(runMap),
      phase: 'victory',
      roster,
      artifacts,
      stats,
    }
  }

  if (layer.options.length > 1) {
    return {
      ...createResetState(runMap),
      phase: 'pathChoice',
      roster,
      encounterIndex,
      encounterText: 'The island offers more than one answer. Choose what comes next.',
      pathOptions: layer.options,
      artifacts,
      stats,
    }
  }

  return moveToEncounter(encounterIndex, layer.options[0]!, roster, stats, artifacts, runMap)
}

function endRound(state: GameState): GameState {
  const selectedIds = new Set(state.selectedTeamIds)
  const roster = decrementCooldowns(
    state.roster.map((creature) =>
      selectedIds.has(creature.id)
        ? {
            ...creature,
            poisonTurns: Math.max(0, creature.poisonTurns),
            poison: creature.poisonTurns <= 0 ? 0 : creature.poison,
          }
        : creature,
    ),
  )

  const enemies = decrementCooldowns(state.enemies)

  return attachCurrentEnemyIntent({
    ...state,
    roster,
    enemies,
    combatTurn: 'player',
  })
}

function advanceAfterWin(
  state: GameState,
  roster: Creature[],
  combatLog: string[],
  lastEffect: CombatEffect | null,
): GameState {
  const encounter = state.currentEncounter
  const nextStats = {
    ...state.stats,
    fightsWon: state.stats.fightsWon + 1,
    encountersCleared: encounter?.type === 'boss' ? state.runMap.length : state.stats.encountersCleared,
  }

  if (encounter?.type === 'boss') {
    return {
      ...state,
      phase: 'victory',
      roster,
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
    combatLog: pushLog(combatLog, 'The path opens a little further.'),
    rewardTier: encounter?.rewardTier ?? 'normal',
    learnOffers: createLearnOffers(roster),
    artifactOffers: encounter?.rewardTier === 'elite' ? createArtifactOffers(state.artifacts) : [],
    stats: nextStats,
    lastEffect,
  }
}

function advanceEnemyQueue(
  state: GameState,
  roster: Creature[],
  enemies: Creature[],
  combatLog: string[],
  lastEffect: CombatEffect | null,
): GameState {
  const nextEnemyIndex = state.enemyQueueIndex + 1
  const nextEnemy = enemies[nextEnemyIndex]

  if (!nextEnemy) {
    return advanceAfterWin(state, roster, combatLog, lastEffect)
  }

  const nextState = {
    ...state,
    roster,
    enemies,
    enemyQueueIndex: nextEnemyIndex,
    combatLog: pushLog(combatLog, `${nextEnemy.name} steps forward from the mist.`),
    freeSwitch: true,
    lastEffect,
  }

  return attachCurrentEnemyIntent(nextState)
}

function performPoisonTicks(
  creatures: Creature[],
  targetIds: string[],
  artifacts: string[],
  combatLog: string[],
) {
  let nextCreatures = creatures
  let nextLog = combatLog
  const affectedIds: string[] = []
  let totalDamage = 0

  for (const targetId of targetIds) {
    const current = nextCreatures.find((creature) => creature.id === targetId && creature.currentHp > 0)
    if (!current || current.poisonTurns <= 0 || current.poison <= 0) {
      continue
    }

    const lethal = current.poison >= current.currentHp
    const triggersLastStand =
      lethal && hasArtifact(artifacts, 'last-stand') && !current.lastStandUsed

    const damage = triggersLastStand ? Math.max(0, current.currentHp - 1) : Math.min(current.currentHp, current.poison)
    const remainingTurns = Math.max(0, current.poisonTurns - 1)
    const nextCreature = {
      ...current,
      currentHp: Math.max(triggersLastStand ? 1 : 0, current.currentHp - damage),
      poisonTurns: remainingTurns,
      poison: remainingTurns === 0 ? 0 : current.poison,
      lastStandUsed: current.lastStandUsed || triggersLastStand,
    }

    nextCreatures = updateCreatureList(nextCreatures, current.id, () => nextCreature)
    nextLog = pushLog(nextLog, `${current.name} suffers ${damage} poison damage.`)
    if (triggersLastStand) {
      nextLog = pushLog(nextLog, `${current.name} refuses to fall and clings to 1 HP.`)
    } else if (nextCreature.currentHp <= 0) {
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
        ? createEffect(totalDamage + affectedIds.length + 500, {
            kind: 'damage',
            targetIds: affectedIds,
            label: `-${totalDamage}`,
            value: totalDamage,
            sound: 'special',
            shake: totalDamage > LARGE_HIT_SHAKE_THRESHOLD,
          })
        : null,
  }
}

function handlePlayerKo(state: GameState, roster: Creature[], combatLog: string[], lastEffect: CombatEffect | null): GameState {
  const livingBench = getLivingCreatures(getBattleRoster(roster, state.selectedTeamIds))
  if (livingBench.length === 0) {
    return {
      ...state,
      phase: 'defeat',
      roster,
      combatLog: pushLog(combatLog, 'The run ends in the island hush.'),
      lastEffect:
        lastEffect ??
        createEffect(state.stats.encountersCleared + state.stats.fightsWon + 40, {
          kind: 'defeat',
          targetIds: [],
          label: 'Lost',
          sound: 'defeat',
        }),
    }
  }

  return {
    ...state,
    roster,
    activeCreatureId: livingBench[0]!.id,
    freeSwitch: true,
    combatLog: pushLog(combatLog, `${livingBench[0]!.name} takes the field. You may switch freely before acting.`),
    lastEffect,
  }
}

function applyThornedRoots(state: GameState): GameState {
  if (!hasArtifact(state.artifacts, 'thorned-roots')) {
    return state
  }

  const currentEnemy = getCurrentEnemy(state.enemies, state.enemyQueueIndex)
  if (!currentEnemy || currentEnemy.currentHp <= 0) {
    return state
  }

  const resolved = applyDamage(currentEnemy, { elemental: 10, element: 'nature' }, state.artifacts, false)
  const enemies = updateCreatureList(state.enemies, currentEnemy.id, () => resolved.creature)
  let combatLog = pushLog(
    state.combatLog,
    `Thorned Roots lash ${currentEnemy.name} for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
  )

  if (resolved.creature.currentHp <= 0) {
    combatLog = pushLog(combatLog, `${currentEnemy.name} falls before it can settle.`)
    return advanceEnemyQueue(
      { ...state, enemies, combatLog },
      state.roster,
      enemies,
      combatLog,
      createEffect(state.stats.encountersCleared + state.stats.fightsWon + 88, {
        kind: 'damage',
        targetIds: [currentEnemy.id],
        label: `-${resolved.damage}`,
        value: resolved.damage,
        sound: 'special',
      }),
    )
  }

  return attachCurrentEnemyIntent({
    ...state,
    enemies,
    combatLog,
    lastEffect: createEffect(state.stats.encountersCleared + state.stats.fightsWon + 88, {
      kind: 'damage',
      targetIds: [currentEnemy.id],
      label: `-${resolved.damage}`,
      value: resolved.damage,
      sound: 'special',
    }),
  })
}

function performSwitch(state: GameState, nextCreatureId: string): GameState {
  const currentActive = getActiveCreature(state.roster, state.activeCreatureId)
  const nextCreature = state.roster.find(
    (creature) => creature.id === nextCreatureId && creature.currentHp > 0 && state.selectedTeamIds.includes(creature.id),
  )

  if (!nextCreature || nextCreature.id === state.activeCreatureId) {
    return state
  }

  let roster = state.roster

  if (currentActive) {
    const transferredRally = currentActive.rallied
    const transferredShield = hasArtifact(state.artifacts, 'living-memory') ? currentActive.shield : 0

    roster = updateCreatureList(roster, currentActive.id, (creature) => ({
      ...creature,
      rallied: 0,
      shield: hasArtifact(state.artifacts, 'living-memory') ? creature.shield : 0,
    }))
    roster = updateCreatureList(roster, nextCreature.id, (creature) => ({
      ...creature,
      rallied: Math.max(creature.rallied, transferredRally),
      shield: Math.max(creature.shield, transferredShield),
    }))
  }

  const switchedState = attachCurrentEnemyIntent({
    ...state,
    roster,
    activeCreatureId: nextCreature.id,
    freeSwitch: false,
    switchesUsedThisFight: state.switchesUsedThisFight + 1,
    combatLog: pushLog(state.combatLog, `${nextCreature.name} takes the field.`),
  })

  return applyThornedRoots(switchedState)
}

function resolveEnemyAction(state: GameState): GameState {
  let roster = state.roster
  let enemies = state.enemies
  let combatLog = state.combatLog
  let lastEffect = state.lastEffect

  const poisonOnTeam = performPoisonTicks(roster, state.selectedTeamIds, state.artifacts, combatLog)
  roster = poisonOnTeam.creatures
  combatLog = poisonOnTeam.combatLog
  lastEffect = poisonOnTeam.lastEffect ?? lastEffect

  const activeCreature = getActiveCreature(roster, state.activeCreatureId)
  const currentEnemy = getCurrentEnemy(enemies, state.enemyQueueIndex)

  if (!activeCreature) {
    return handlePlayerKo(state, roster, combatLog, lastEffect)
  }
  if (!currentEnemy || currentEnemy.currentHp <= 0) {
    return advanceEnemyQueue(state, roster, enemies, combatLog, lastEffect)
  }

  const intent = currentEnemy.intent ?? resolveEnemyIntent(currentEnemy.possibleIntents ?? generatePossibleIntents(currentEnemy))
  enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
    ...creature,
    intent,
  }))

  if (currentEnemy.charging) {
    const specialIndex = currentEnemy.specials.findIndex((special) => special.id === currentEnemy.charging?.specialId)
    const special = currentEnemy.specials[specialIndex]
    if (!special) {
      enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({ ...creature, charging: undefined }))
      return attachCurrentEnemyIntent({ ...state, roster, enemies, combatLog, lastEffect })
    }

    if (currentEnemy.charging.turnsRemaining > 1) {
      enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
        ...creature,
        charging: creature.charging
          ? { ...creature.charging, turnsRemaining: creature.charging.turnsRemaining - 1 }
          : undefined,
      }))
      combatLog = pushLog(combatLog, `${currentEnemy.name} keeps charging ${special.name}.`)
      return attachCurrentEnemyIntent({
        ...state,
        roster,
        enemies,
        combatLog,
        lastEffect: createEffect(state.stats.encountersCleared + state.stats.fightsWon + 90, {
          kind: 'buff',
          targetIds: [currentEnemy.id],
          label: 'Charging',
          sound: 'special',
        }),
      })
    }

    const resolved = applyDamage(activeCreature, { elemental: special.value, element: special.element ?? currentEnemy.element }, state.artifacts, true)
    roster = updateCreatureList(roster, activeCreature.id, () => resolved.creature)
    enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
      ...creature,
      charging: undefined,
      specials: creature.specials.map((entry, index) =>
        index === specialIndex ? { ...entry, currentCooldown: entry.cooldown } : entry,
      ),
    }))
    combatLog = pushLog(
      combatLog,
      `${currentEnemy.name} unleashes ${special.name} for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
    )
    if (resolved.lastStandTriggered) {
      combatLog = pushLog(combatLog, `${activeCreature.name} clings to 1 HP.`)
    }
    if (resolved.creature.currentHp <= 0) {
      combatLog = pushLog(combatLog, `${activeCreature.name} falls still.`)
    }
    lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 91, {
      kind: 'damage',
      targetIds: [activeCreature.id],
      label: `-${resolved.damage}`,
      value: resolved.damage,
      sound: 'special',
      shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
    })
  } else if (intent.action === 'attack') {
    const resolved = applyDamage(
      activeCreature,
      {
        physical: getAttack(state.artifacts, currentEnemy) + currentEnemy.rallied,
        elemental: currentEnemy.elementalAttack,
        element: currentEnemy.element,
      },
      state.artifacts,
      true,
    )
    roster = updateCreatureList(roster, activeCreature.id, () => resolved.creature)
    enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({ ...creature, rallied: 0 }))
    combatLog = pushLog(
      combatLog,
      `${currentEnemy.name} attacks for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
    )
    if (resolved.lastStandTriggered) {
      combatLog = pushLog(combatLog, `${activeCreature.name} clings to 1 HP.`)
    }
    if (resolved.creature.currentHp <= 0) {
      combatLog = pushLog(combatLog, `${activeCreature.name} can no longer answer the call.`)
    }
    lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 92, {
      kind: 'damage',
      targetIds: [activeCreature.id],
      label: `-${resolved.damage}`,
      value: resolved.damage,
      sound: 'hit',
      shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
    })
  } else {
    const specialIndex = currentEnemy.specials.findIndex((special) => special.id === intent.specialId)
    const special = currentEnemy.specials[specialIndex]
    if (!special || special.currentCooldown > 0) {
      return attachCurrentEnemyIntent({ ...state, roster, enemies, combatLog, lastEffect })
    }

    if (intent.action === 'charge') {
      enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
        ...creature,
        charging: {
          specialId: special.id,
          targetId: activeCreature.id,
          turnsRemaining: special.chargeTurns ?? 1,
        },
      }))
      combatLog = pushLog(combatLog, `${currentEnemy.name} begins charging ${special.name}.`)
      lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 93, {
        kind: 'buff',
        targetIds: [currentEnemy.id],
        label: 'Charging',
        sound: 'special',
      })
    } else {
      enemies = updateSpecial(enemies, currentEnemy.id, specialIndex, (current) => ({
        ...current,
        currentCooldown: current.cooldown,
      }))

      if (special.type === 'strike') {
        const resolved = applyDamage(activeCreature, { elemental: special.value, element: special.element ?? currentEnemy.element }, state.artifacts, true)
        roster = updateCreatureList(roster, activeCreature.id, () => resolved.creature)
        combatLog = pushLog(
          combatLog,
          `${currentEnemy.name} uses ${special.name} for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
        )
        if (resolved.lastStandTriggered) {
          combatLog = pushLog(combatLog, `${activeCreature.name} clings to 1 HP.`)
        }
        if (resolved.creature.currentHp <= 0) {
          combatLog = pushLog(combatLog, `${activeCreature.name} falls still.`)
        }
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 94, {
          kind: 'damage',
          targetIds: [activeCreature.id],
          label: `-${resolved.damage}`,
          value: resolved.damage,
          sound: 'special',
          shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
        })
      } else if (special.type === 'guard') {
        enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
          ...creature,
          shield: Math.max(creature.shield, special.value),
        }))
        combatLog = pushLog(combatLog, `${currentEnemy.name} braces for the next hit.`)
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 95, {
          kind: 'shield',
          targetIds: [currentEnemy.id],
          label: `Shield ${special.value}`,
          value: special.value,
          sound: 'guard',
        })
      } else if (special.type === 'mend') {
        enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
          ...creature,
          currentHp: Math.min(creature.maxHp, creature.currentHp + special.value),
          poisonTurns: Math.max(0, creature.poisonTurns - 1),
          poison: Math.max(0, creature.poisonTurns - 1) === 0 ? 0 : creature.poison,
        }))
        combatLog = pushLog(combatLog, `${currentEnemy.name} restores ${special.value} HP.`)
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 96, {
          kind: 'heal',
          targetIds: [currentEnemy.id],
          label: `+${special.value}`,
          value: special.value,
          sound: 'heal',
        })
      } else if (special.type === 'weaken') {
        roster = updateCreatureList(roster, activeCreature.id, (creature) => ({
          ...creature,
          weakened: Math.max(creature.weakened, special.value),
        }))
        combatLog = pushLog(combatLog, `${currentEnemy.name} leaves ${activeCreature.name} exposed.`)
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 97, {
          kind: 'buff',
          targetIds: [activeCreature.id],
          label: `Weaken +${special.value}`,
          value: special.value,
          sound: 'special',
        })
      } else if (special.type === 'rally') {
        enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
          ...creature,
          rallied: Math.max(creature.rallied, special.value),
        }))
        combatLog = pushLog(combatLog, `${currentEnemy.name} gathers force.`)
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 98, {
          kind: 'buff',
          targetIds: [currentEnemy.id],
          label: `Rally +${special.value}`,
          value: special.value,
          sound: 'special',
        })
      } else if (special.type === 'poison') {
        roster = updateCreatureList(roster, activeCreature.id, (creature) => ({
          ...creature,
          poison: Math.max(creature.poison, special.value),
          poisonTurns: Math.max(creature.poisonTurns, POISON_DURATION),
        }))
        combatLog = pushLog(combatLog, `${currentEnemy.name} poisons ${activeCreature.name}.`)
        lastEffect = createEffect(state.stats.encountersCleared + state.stats.fightsWon + 99, {
          kind: 'buff',
          targetIds: [activeCreature.id],
          label: `Poison ${special.value}`,
          value: special.value,
          sound: 'special',
        })
      }
    }
  }

  const currentActiveAfterEnemy = getActiveCreature(roster, state.activeCreatureId)
  if (!currentActiveAfterEnemy) {
    return handlePlayerKo(
      {
        ...state,
        roster,
        enemies,
      },
      roster,
      combatLog,
      lastEffect,
    )
  }

  const poisonOnEnemy = currentEnemy ? performPoisonTicks(enemies, [currentEnemy.id], state.artifacts, combatLog) : null
  if (poisonOnEnemy) {
    enemies = poisonOnEnemy.creatures
    combatLog = poisonOnEnemy.combatLog
    lastEffect = poisonOnEnemy.lastEffect ?? lastEffect
  }

  const enemyAfterPoison = getCurrentEnemy(enemies, state.enemyQueueIndex)
  if (!enemyAfterPoison || enemyAfterPoison.currentHp <= 0) {
    return advanceEnemyQueue(
      {
        ...state,
        roster,
        enemies,
      },
      roster,
      enemies,
      combatLog,
      lastEffect,
    )
  }

  return attachCurrentEnemyIntent({
    ...state,
    roster,
    enemies,
    combatLog,
    lastEffect,
  })
}

function resolvePlayerAttack(state: GameState): GameState {
  const actor = getActiveCreature(state.roster, state.activeCreatureId)
  const currentEnemy = getCurrentEnemy(state.enemies, state.enemyQueueIndex)
  if (!actor || !currentEnemy || currentEnemy.currentHp <= 0) {
    return state
  }

  const resolved = applyDamage(
    currentEnemy,
    {
      physical: getAttack(state.artifacts, actor) + actor.rallied,
      elemental: actor.elementalAttack,
      element: actor.element,
    },
    state.artifacts,
    false,
  )

  const roster = updateCreatureList(state.roster, actor.id, (creature) => ({
    ...creature,
    rallied: 0,
  }))
  let enemies = updateCreatureList(state.enemies, currentEnemy.id, () => resolved.creature)
  let combatLog = pushLog(
    state.combatLog,
    `${actor.name} attacks for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
  )

  if (hasArtifact(state.artifacts, 'venom-fang') && resolved.creature.currentHp > 0) {
    enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
      ...creature,
      poison: Math.max(creature.poison, 5),
      poisonTurns: Math.max(creature.poisonTurns, 2),
    }))
    combatLog = pushLog(combatLog, `${currentEnemy.name} is nicked by venom.`)
  }

  if (resolved.creature.currentHp <= 0) {
    combatLog = pushLog(combatLog, `${currentEnemy.name} falls quiet.`)
    return advanceEnemyQueue(
      {
        ...state,
        roster,
        enemies,
        combatLog,
      },
      roster,
      enemies,
      combatLog,
      createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 100, {
        kind: 'damage',
        targetIds: [currentEnemy.id],
        label: `-${resolved.damage}`,
        value: resolved.damage,
        sound: 'hit',
        shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
      }),
    )
  }

  return attachCurrentEnemyIntent({
    ...state,
    roster,
    enemies,
    combatLog,
    lastEffect: createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 100, {
      kind: 'damage',
      targetIds: [currentEnemy.id],
      label: `-${resolved.damage}`,
      value: resolved.damage,
      sound: 'hit',
      shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
    }),
  })
}

function resolvePlayerSpecial(state: GameState, specialIndex: number): GameState {
  const actor = getActiveCreature(state.roster, state.activeCreatureId)
  const currentEnemy = getCurrentEnemy(state.enemies, state.enemyQueueIndex)
  if (!actor || !currentEnemy) {
    return state
  }

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
    const resolved = applyDamage(currentEnemy, { elemental: special.value, element: special.element ?? actor.element }, state.artifacts, false)
    enemies = updateCreatureList(enemies, currentEnemy.id, () => resolved.creature)
    combatLog = pushLog(
      combatLog,
      `${actor.name} uses ${special.name} for ${resolved.damage}${buildDamageBreakdown(resolved) ? ` (${buildDamageBreakdown(resolved)})` : ''}.`,
    )
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 101, {
      kind: 'damage',
      targetIds: [currentEnemy.id],
      label: `-${resolved.damage}`,
      value: resolved.damage,
      sound: 'special',
      shake: resolved.damage > LARGE_HIT_SHAKE_THRESHOLD,
    })
    if (resolved.creature.currentHp <= 0) {
      combatLog = pushLog(combatLog, `${currentEnemy.name} is driven back into the mist.`)
      return advanceEnemyQueue(
        {
          ...state,
          roster,
          enemies,
          combatLog,
        },
        roster,
        enemies,
        combatLog,
        lastEffect,
      )
    }
  } else if (special.type === 'guard') {
    roster = updateCreatureList(roster, actor.id, (creature) => ({
      ...creature,
      shield: Math.max(creature.shield, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} braces for impact.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 102, {
      kind: 'shield',
      targetIds: [actor.id],
      label: `Shield ${special.value}`,
      value: special.value,
      sound: 'guard',
    })
  } else if (special.type === 'mend') {
    roster = updateCreatureList(roster, actor.id, (creature) => ({
      ...creature,
      currentHp: Math.min(creature.maxHp, creature.currentHp + special.value),
      poisonTurns:
        hasArtifact(state.artifacts, 'tidal-charm') ? Math.max(0, creature.poisonTurns - 1) : creature.poisonTurns,
      poison:
        hasArtifact(state.artifacts, 'tidal-charm') && creature.poisonTurns <= 1 ? 0 : creature.poison,
    }))
    combatLog = pushLog(combatLog, `${actor.name} restores ${special.value} HP.`)
    if (hasArtifact(state.artifacts, 'tidal-charm')) {
      combatLog = pushLog(combatLog, `${actor.name} shakes off some of the poison.`)
    }
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 103, {
      kind: 'heal',
      targetIds: [actor.id],
      label: `+${special.value}`,
      value: special.value,
      sound: 'heal',
    })
  } else if (special.type === 'rally') {
    roster = updateCreatureList(roster, actor.id, (creature) => ({
      ...creature,
      rallied: Math.max(creature.rallied, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} gathers force for the next strike.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 104, {
      kind: 'buff',
      targetIds: [actor.id],
      label: `Rally +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  } else if (special.type === 'weaken') {
    enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
      ...creature,
      weakened: Math.max(creature.weakened, special.value),
    }))
    combatLog = pushLog(combatLog, `${actor.name} exposes ${currentEnemy.name}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 105, {
      kind: 'buff',
      targetIds: [currentEnemy.id],
      label: `Weaken +${special.value}`,
      value: special.value,
      sound: 'special',
    })
  } else if (special.type === 'poison') {
    enemies = updateCreatureList(enemies, currentEnemy.id, (creature) => ({
      ...creature,
      poison: Math.max(creature.poison, special.value),
      poisonTurns: Math.max(creature.poisonTurns, POISON_DURATION),
    }))
    combatLog = pushLog(combatLog, `${actor.name} poisons ${currentEnemy.name}.`)
    lastEffect = createEffect(state.stats.boostsGiven + state.stats.fightsWon + state.encounterIndex + 106, {
      kind: 'buff',
      targetIds: [currentEnemy.id],
      label: `Poison ${special.value}`,
      value: special.value,
      sound: 'special',
    })
  }

  return attachCurrentEnemyIntent({
    ...state,
    roster,
    enemies,
    combatLog,
    lastEffect,
  })
}

function applyRewardToRoster(
  roster: Creature[],
  reward: RewardType,
  learnOffers: SpecialTemplate[],
  artifactOffers: ArtifactDefinition[],
  creatureId?: string,
) {
  if (reward.type === 'rest') {
    return {
      roster: roster.map((creature) => healCreaturePercent(creature, 0.4)),
      artifacts: [] as string[],
    }
  }

  if (reward.type === 'artifact') {
    const artifact = artifactOffers.find((entry) => entry.id === reward.artifactId)
    return {
      roster,
      artifacts: artifact ? [artifact.id] : [],
    }
  }

  if (!creatureId) {
    return {
      roster,
      artifacts: [] as string[],
    }
  }

  if (reward.type === 'hp') {
    return {
      roster: updateCreatureList(roster, creatureId, (creature) => {
        const nextMaxHp = creature.maxHp + 10
        return {
          ...creature,
          maxHp: nextMaxHp,
          currentHp: Math.min(nextMaxHp, creature.currentHp + 10),
        }
      }),
      artifacts: [] as string[],
    }
  }

  if (reward.type === 'atk') {
    return {
      roster: updateCreatureList(roster, creatureId, (creature) => ({
        ...creature,
        attack: creature.attack + 5,
      })),
      artifacts: [] as string[],
    }
  }

  if (reward.type === 'speed') {
    return {
      roster: updateCreatureList(roster, creatureId, (creature) => ({
        ...creature,
        speed: creature.speed + 1,
      })),
      artifacts: [] as string[],
    }
  }

  return {
    roster: updateCreatureList(roster, creatureId, (creature) => {
      const offer = learnOffers.find((special) => special.id === reward.specialId)
      if (!offer || creature.specials.length >= 2 || creature.specials.some((special) => special.id === offer.id)) {
        return creature
      }

      return {
        ...creature,
        specials: [...creature.specials, { ...offer, currentCooldown: 0 }],
      }
    }),
    artifacts: [] as string[],
  }
}

function resolveEvent(state: GameState, choiceId: string, creatureId?: string): GameState {
  let roster = state.roster
  let artifacts = state.artifacts

  if (state.currentEventId === 'strange-pool' && choiceId === 'drink' && creatureId) {
    roster = updateCreatureList(roster, creatureId, (creature) => ({
      ...creature,
      currentHp: Math.min(creature.maxHp, creature.currentHp + Math.ceil(creature.maxHp * 0.5)),
      speed: Math.max(1, creature.speed - 1),
    }))
  }

  if (state.currentEventId === 'wandering-merchant' && choiceId === 'buy-power' && creatureId) {
    roster = updateCreatureList(roster, creatureId, (creature) => ({
      ...creature,
      attack: creature.attack + 10,
      maxHp: Math.max(1, creature.maxHp - 10),
      currentHp: Math.min(Math.max(1, creature.maxHp - 10), creature.currentHp),
    }))
  }

  if (state.currentEventId === 'forgotten-shrine' && choiceId === 'sacrifice-slot' && creatureId) {
    roster = updateCreatureList(roster, creatureId, (creature) => ({
      ...creature,
      specials: creature.specials
        .slice(0, 1)
        .map((special) => ({
          ...special,
          value: special.value + 20,
          cooldown: Math.max(1, special.cooldown - 1),
        })),
    }))
  }

  if (state.currentEventId === 'islands-gift' && choiceId === 'take-gift') {
    const artifactOffers = createArtifactOffers(artifacts)
    if (artifactOffers[0]) {
      artifacts = [...artifacts, artifactOffers[0].id]
    }
  }

  return moveToLayer(
    state.encounterIndex + 1,
    roster,
    {
      ...state.stats,
      encountersCleared: state.stats.encountersCleared + 1,
    },
    artifacts,
    state.runMap,
  )
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_RUN': {
      const runMap = generateRunMap()
      const roster = STARTER_CREATURES.map((template) => instantiateCreature(template))
      return moveToLayer(0, roster, initialStats, [], runMap)
    }

    case 'CHOOSE_PATH': {
      const encounter = getEncounterOption(state.pathOptions, action.encounterId)
      if (!encounter) {
        return state
      }

      return moveToEncounter(state.encounterIndex, encounter, state.roster, state.stats, state.artifacts, state.runMap)
    }

    case 'SELECT_TEAM': {
      if (!state.currentEncounter) {
        return state
      }

      const roster = prepareRosterForBattle(state.roster, state.artifacts)
      const selectedTeamIds = action.ids.filter((id) => state.availableCreatureIds.includes(id))
      const enemies = createEnemyQueue(state.currentEncounter)

      return attachCurrentEnemyIntent({
        ...state,
        phase: 'combat',
        roster,
        selectedTeamIds,
        activeCreatureId: selectedTeamIds[0] ?? null,
        enemies,
        enemyQueueIndex: 0,
        combatLog: [state.encounterText, `${(enemies[0]?.name ?? 'Something')} emerges from the hush.`],
        combatTurn: 'player',
        freeSwitch: false,
        switchesUsedThisFight: 0,
        lastEffect: null,
      })
    }

    case 'SWITCH': {
      if (state.phase !== 'combat') {
        return state
      }

      const isFreeSwitch =
        state.freeSwitch || (hasArtifact(state.artifacts, 'ghost-step') && state.switchesUsedThisFight === 0)
      const switched = performSwitch(state, action.creatureId)

      if (switched.phase !== 'combat') {
        return switched
      }

      if (isFreeSwitch) {
        return {
          ...switched,
          combatTurn: 'player',
        }
      }

      return endRound(resolveEnemyAction(switched))
    }

    case 'PLAYER_ACTION': {
      if (state.phase !== 'combat') {
        return state
      }

      const actor = getActiveCreature(state.roster, state.activeCreatureId)
      const enemy = getCurrentEnemy(state.enemies, state.enemyQueueIndex)
      if (!actor || !enemy) {
        return state
      }

      const enemyActsFirst = !state.freeSwitch && getSpeed(state.artifacts, enemy) > getSpeed(state.artifacts, actor)
      let nextState = state

      if (enemyActsFirst) {
        nextState = resolveEnemyAction(nextState)
        if (nextState.phase !== 'combat') {
          return nextState
        }

        const actorAfterEnemy = getActiveCreature(nextState.roster, nextState.activeCreatureId)
        const enemyAfterEnemy = getCurrentEnemy(nextState.enemies, nextState.enemyQueueIndex)
        if (!actorAfterEnemy || !enemyAfterEnemy || actorAfterEnemy.id !== actor.id) {
          return endRound(nextState)
        }
      }

      nextState =
        action.action === 'attack'
          ? resolvePlayerAttack(nextState)
          : resolvePlayerSpecial(nextState, action.specialIndex ?? 0)

      if (nextState.phase !== 'combat') {
        return nextState
      }

      if (nextState.freeSwitch) {
        return endRound(nextState)
      }

      if (!enemyActsFirst) {
        nextState = resolveEnemyAction(nextState)
      }

      if (nextState.phase !== 'combat') {
        return nextState
      }

      return endRound(nextState)
    }

    case 'ENEMY_TURN':
      return state

    case 'APPLY_REWARD': {
      const applied = applyRewardToRoster(
        state.roster,
        action.reward,
        state.learnOffers,
        state.artifactOffers,
        action.creatureId,
      )
      return {
        ...state,
        roster: applied.roster,
        artifacts: [...state.artifacts, ...applied.artifacts],
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
          creature.currentHp > 0 ? Math.min(creature.maxHp, creature.currentHp + 15) : creature.currentHp,
      }))

      return {
        ...state,
        roster: [...healedRoster, recruit],
        stats: {
          ...state.stats,
          recruited: [...state.stats.recruited, recruit.name],
        },
        lastEffect: createEffect(state.stats.encountersCleared + state.stats.boostsGiven + 120, {
          kind: 'heal',
          targetIds: healedRoster.map((creature) => creature.id),
          label: '+15',
          value: 15,
          sound: 'heal',
        }),
      }
    }

    case 'SKIP_RECRUIT':
      return state

    case 'REST_AND_CONTINUE': {
      const restedRoster = state.roster.map((creature) => healCreaturePercent(creature, 0.4))
      return moveToLayer(
        state.encounterIndex + 1,
        restedRoster,
        {
          ...state.stats,
          encountersCleared: state.stats.encountersCleared + 1,
        },
        state.artifacts,
        state.runMap,
      )
    }

    case 'RESOLVE_EVENT':
      return resolveEvent(state, action.choiceId, action.creatureId)

    case 'NEXT_ENCOUNTER':
      return moveToLayer(
        state.encounterIndex + 1,
        state.roster,
        {
          ...state.stats,
          encountersCleared: state.stats.encountersCleared + 1,
        },
        state.artifacts,
        state.runMap,
      )

    case 'RESTART':
      return {
        ...initialState,
        runMap: generateRunMap(),
      }

    default:
      return state
  }
}

export function useRunState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const selectedTeam = useMemo(
    () => state.roster.filter((creature) => state.selectedTeamIds.includes(creature.id)),
    [state.roster, state.selectedTeamIds],
  )

  const availableCreatures = useMemo(
    () => state.roster.filter((creature) => state.availableCreatureIds.includes(creature.id)),
    [state.roster, state.availableCreatureIds],
  )

  const activeCreature = useMemo(
    () => getActiveCreature(state.roster, state.activeCreatureId),
    [state.activeCreatureId, state.roster],
  )

  const currentEnemy = useMemo(
    () => getCurrentEnemy(state.enemies, state.enemyQueueIndex),
    [state.enemies, state.enemyQueueIndex],
  )

  const currentEvent = useMemo(() => getCurrentEvent(state.currentEventId), [state.currentEventId])

  return {
    state,
    dispatch,
    selectedTeam,
    availableCreatures,
    activeCreature,
    currentEnemy,
    currentEvent,
  }
}
