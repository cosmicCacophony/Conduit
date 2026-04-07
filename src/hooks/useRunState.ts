import { useMemo, useReducer } from 'react'

import { ALL_CREATURES } from '../data/creatures'
import { ENEMY_TEMPLATES } from '../data/encounters'
import { describeEffect, findSpell } from '../data/spells'
import type {
  CombatEffect,
  CreatureTemplate,
  ElementCard,
  EnemyIntent,
  EnemyState,
  EnemyTemplate,
  GameAction,
  GameState,
} from '../types'

const PLAYER_MAX_HP = 30
const HAND_SIZE = 5
const HEAL_BETWEEN_FIGHTS = 5
const MAX_LOG_LINES = 12

const initialStats: GameState['stats'] = { fightsWon: 0 }

const initialState: GameState = {
  phase: 'title',
  team: [],
  fullDeck: [],
  drawPile: [],
  discardPile: [],
  hand: [],
  selectedIndices: [],
  playerHp: PLAYER_MAX_HP,
  playerMaxHp: PLAYER_MAX_HP,
  playerBlock: 0,
  playerBurn: 0,
  encounters: [],
  encounterIndex: 0,
  enemy: null,
  combatLog: [],
  lastEffect: null,
  stats: initialStats,
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]!
    next[j] = tmp!
  }
  return next
}

function pushLog(lines: string[], entry: string): string[] {
  return [...lines, entry].slice(-MAX_LOG_LINES)
}

let effectTick = 0
function nextEffect(effect: Omit<CombatEffect, 'tick'>): CombatEffect {
  effectTick += 1
  return { tick: effectTick, ...effect }
}

function buildDeck(team: CreatureTemplate[]): ElementCard[] {
  const cards: ElementCard[] = []
  for (const creature of team) {
    for (const value of creature.cardValues) {
      cards.push({ element: creature.element, value, creatureId: creature.id })
    }
  }
  return cards
}

function drawCards(
  drawPile: ElementCard[],
  discardPile: ElementCard[],
  count: number,
): { hand: ElementCard[]; drawPile: ElementCard[]; discardPile: ElementCard[] } {
  let pile = [...drawPile]
  let discard = [...discardPile]
  const drawn: ElementCard[] = []

  while (drawn.length < count) {
    if (pile.length === 0) {
      if (discard.length === 0) break
      pile = shuffle(discard)
      discard = []
    }
    drawn.push(pile.pop()!)
  }

  return { hand: drawn, drawPile: pile, discardPile: discard }
}

function pickIntent(template: EnemyTemplate | EnemyState): EnemyIntent {
  const pool = template.intents
  return pool[Math.floor(Math.random() * pool.length)]!
}

function createEnemy(template: EnemyTemplate): EnemyState {
  return {
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    maxHp: template.maxHp,
    currentHp: template.maxHp,
    block: 0,
    burn: 0,
    currentIntent: pickIntent(template),
    intents: template.intents,
    charging: null,
  }
}

function dealDamageToEnemy(enemy: EnemyState, rawDamage: number): { enemy: EnemyState; dealt: number; blocked: number } {
  const blocked = Math.min(enemy.block, rawDamage)
  const dealt = rawDamage - blocked
  return {
    enemy: {
      ...enemy,
      block: enemy.block - blocked,
      currentHp: Math.max(0, enemy.currentHp - dealt),
    },
    dealt,
    blocked,
  }
}

function dealDamageToPlayer(state: GameState, rawDamage: number): { playerHp: number; playerBlock: number; dealt: number; blocked: number } {
  const blocked = Math.min(state.playerBlock, rawDamage)
  const dealt = rawDamage - blocked
  return {
    playerHp: Math.max(0, state.playerHp - dealt),
    playerBlock: state.playerBlock - blocked,
    dealt,
    blocked,
  }
}

function advanceEncounter(state: GameState): GameState {
  const nextIndex = state.encounterIndex + 1

  if (nextIndex >= state.encounters.length) {
    return {
      ...state,
      phase: 'victory',
      combatLog: pushLog(state.combatLog, 'The island exhales. You have crossed.'),
      stats: { ...state.stats, fightsWon: state.stats.fightsWon + 1 },
      lastEffect: nextEffect({
        kind: 'victory',
        targetIds: [],
        label: 'Victory',
        sound: 'victory',
        shake: true,
      }),
    }
  }

  const nextEnemy = createEnemy(state.encounters[nextIndex]!)
  const reshuffled = shuffle([...state.fullDeck])
  const { hand, drawPile, discardPile } = drawCards(reshuffled, [], HAND_SIZE)

  return {
    ...state,
    encounterIndex: nextIndex,
    enemy: nextEnemy,
    playerHp: Math.min(state.playerMaxHp, state.playerHp + HEAL_BETWEEN_FIGHTS),
    playerBlock: 0,
    playerBurn: 0,
    drawPile,
    discardPile,
    hand,
    selectedIndices: [],
    combatLog: pushLog(
      pushLog(state.combatLog, `${state.enemy?.name ?? 'The enemy'} falls quiet.`),
      `${nextEnemy.name} appears. +${HEAL_BETWEEN_FIGHTS} HP recovered.`,
    ),
    stats: { ...state.stats, fightsWon: state.stats.fightsWon + 1 },
    lastEffect: nextEffect({
      kind: 'victory',
      targetIds: [],
      label: 'Defeated',
      sound: 'victory',
    }),
  }
}

function startNewRound(state: GameState): GameState {
  let { playerHp, playerBurn, enemy, combatLog } = state
  let lastEffect: CombatEffect | null = state.lastEffect

  const playerBlock = 0

  if (playerBurn > 0) {
    playerHp = Math.max(0, playerHp - playerBurn)
    combatLog = pushLog(combatLog, `You take ${playerBurn} burn damage.`)
    playerBurn = Math.max(0, playerBurn - 1)
    lastEffect = nextEffect({
      kind: 'damage',
      targetIds: ['player'],
      label: `-${state.playerBurn}`,
      value: state.playerBurn,
      sound: 'hit',
    })
  }

  if (playerHp <= 0) {
    return {
      ...state,
      phase: 'defeat',
      playerHp: 0,
      playerBlock: 0,
      playerBurn: playerBurn,
      combatLog: pushLog(combatLog, 'The flames consume you. The run ends.'),
      lastEffect: nextEffect({ kind: 'defeat', targetIds: [], label: 'Defeated', sound: 'defeat' }),
    }
  }

  if (enemy && enemy.burn > 0) {
    const burnDmg = enemy.burn
    const nextEnemyHp = Math.max(0, enemy.currentHp - burnDmg)
    combatLog = pushLog(combatLog, `${enemy.name} takes ${burnDmg} burn damage.`)
    enemy = {
      ...enemy,
      currentHp: nextEnemyHp,
      burn: Math.max(0, enemy.burn - 1),
    }
    lastEffect = nextEffect({
      kind: 'damage',
      targetIds: [enemy.id],
      label: `-${burnDmg}`,
      value: burnDmg,
      sound: 'special',
    })

    if (nextEnemyHp <= 0) {
      return advanceEncounter({
        ...state,
        playerHp,
        playerBlock,
        playerBurn,
        enemy,
        combatLog,
        lastEffect,
      })
    }
  }

  // Discard remaining hand, draw a new hand
  const newDiscard = [...state.discardPile, ...state.hand]
  const { hand: newHand, drawPile, discardPile } = drawCards(state.drawPile, newDiscard, HAND_SIZE)

  if (enemy?.charging != null) {
    const chargedIntent: EnemyIntent = { type: 'attack', value: enemy.charging, label: `Heavy Attack ${enemy.charging}` }
    enemy = { ...enemy, charging: null, currentIntent: chargedIntent }
  } else if (enemy) {
    enemy = { ...enemy, currentIntent: pickIntent(enemy) }
  }

  return {
    ...state,
    playerHp,
    playerBlock,
    playerBurn,
    enemy: enemy ?? null,
    drawPile,
    discardPile,
    hand: newHand,
    selectedIndices: [],
    combatLog,
    lastEffect,
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_RUN': {
      return {
        ...initialState,
        phase: 'teamSelect',
      }
    }

    case 'SELECT_TEAM': {
      const team = action.creatureIds
        .map((id) => ALL_CREATURES.find((c) => c.id === id))
        .filter((c): c is CreatureTemplate => c != null)
        .slice(0, 3)

      if (team.length < 3) {
        return state
      }

      const fullDeck = buildDeck(team)
      const shuffled = shuffle([...fullDeck])
      const { hand, drawPile, discardPile } = drawCards(shuffled, [], HAND_SIZE)
      const encounters = [...ENEMY_TEMPLATES]
      const firstEnemy = createEnemy(encounters[0]!)
      const teamNames = team.map((c) => c.name).join(', ')

      return {
        ...initialState,
        phase: 'combat',
        team,
        fullDeck,
        drawPile,
        discardPile,
        hand,
        selectedIndices: [],
        playerHp: PLAYER_MAX_HP,
        playerMaxHp: PLAYER_MAX_HP,
        playerBlock: 0,
        playerBurn: 0,
        encounters,
        encounterIndex: 0,
        enemy: firstEnemy,
        combatLog: [
          `Your team: ${teamNames}.`,
          `${firstEnemy.name} emerges from the hush.`,
        ],
        lastEffect: null,
        stats: initialStats,
      }
    }

    case 'TOGGLE_CARD': {
      if (state.phase !== 'combat') return state
      const idx = action.index
      if (idx < 0 || idx >= state.hand.length) return state

      const selected = state.selectedIndices.includes(idx)
        ? state.selectedIndices.filter((i) => i !== idx)
        : [...state.selectedIndices, idx]

      return { ...state, selectedIndices: selected }
    }

    case 'CAST_SPELL': {
      if (state.phase !== 'combat' || !state.enemy || state.enemy.currentHp <= 0) return state
      if (state.selectedIndices.length === 0) return state

      const selectedCards = state.selectedIndices.map((i) => state.hand[i]!)
      const selectedElements = selectedCards.map((c) => c.element)
      const spell = findSpell(selectedElements)
      if (!spell) return state

      const effect = spell.compute(selectedCards)

      let enemy = { ...state.enemy }
      let { playerHp, playerBlock, playerBurn } = state
      let combatLog = state.combatLog
      let lastEffect: CombatEffect | null = null
      const parts: string[] = []

      if (effect.damage) {
        const result = dealDamageToEnemy(enemy, effect.damage)
        enemy = result.enemy
        parts.push(`${result.dealt} damage${result.blocked > 0 ? ` (${result.blocked} blocked)` : ''}`)
        lastEffect = nextEffect({
          kind: 'damage',
          targetIds: [enemy.id],
          label: `-${result.dealt}`,
          value: result.dealt,
          sound: spell.tier >= 2 ? 'special' : 'hit',
          shake: result.dealt >= 10,
        })
      }

      if (effect.block) {
        playerBlock += effect.block
        parts.push(`${effect.block} block`)
        if (!lastEffect) {
          lastEffect = nextEffect({
            kind: 'shield',
            targetIds: ['player'],
            label: `+${effect.block}`,
            value: effect.block,
            sound: 'guard',
          })
        }
      }

      if (effect.heal) {
        const healed = Math.min(effect.heal, state.playerMaxHp - playerHp)
        playerHp = Math.min(state.playerMaxHp, playerHp + effect.heal)
        parts.push(`${healed} heal`)
        if (!lastEffect) {
          lastEffect = nextEffect({
            kind: 'heal',
            targetIds: ['player'],
            label: `+${healed}`,
            value: healed,
            sound: 'heal',
          })
        }
      }

      if (effect.burn) {
        enemy = { ...enemy, burn: enemy.burn + effect.burn }
        parts.push(`${effect.burn} burn`)
      }

      if (effect.cleanse) {
        playerBurn = 0
        parts.push('cleanse')
      }

      const computedDesc = describeEffect(effect)
      combatLog = pushLog(combatLog, `Cast ${spell.name} (${computedDesc}).`)

      // Consumed cards go to discard pile; remaining hand stays
      const remainingHand = state.hand.filter((_, i) => !state.selectedIndices.includes(i))
      const usedCards = state.selectedIndices.map((i) => state.hand[i]!)
      const newDiscard = [...state.discardPile, ...usedCards]

      const nextState: GameState = {
        ...state,
        enemy,
        playerHp,
        playerBlock,
        playerBurn,
        hand: remainingHand,
        discardPile: newDiscard,
        selectedIndices: [],
        combatLog,
        lastEffect,
      }

      if (enemy.currentHp <= 0) {
        return advanceEncounter(nextState)
      }

      return nextState
    }

    case 'END_TURN': {
      if (state.phase !== 'combat' || !state.enemy) return state

      let enemy = { ...state.enemy }
      let { playerHp, playerBlock, playerBurn } = state
      let combatLog = state.combatLog
      let lastEffect: CombatEffect | null = null

      enemy = { ...enemy, block: 0 }

      const intent = enemy.currentIntent

      if (intent.type === 'attack') {
        const result = dealDamageToPlayer(
          { ...state, playerHp, playerBlock },
          intent.value,
        )
        playerHp = result.playerHp
        playerBlock = result.playerBlock
        combatLog = pushLog(
          combatLog,
          `${enemy.name} attacks for ${intent.value}${result.blocked > 0 ? ` (${result.blocked} blocked)` : ''} — you take ${result.dealt} damage.`,
        )
        lastEffect = nextEffect({
          kind: 'damage',
          targetIds: ['player'],
          label: `-${result.dealt}`,
          value: result.dealt,
          sound: 'hit',
          shake: result.dealt >= 10,
        })
      } else if (intent.type === 'defend') {
        enemy = { ...enemy, block: intent.value }
        combatLog = pushLog(combatLog, `${enemy.name} braces, gaining ${intent.value} block.`)
        lastEffect = nextEffect({
          kind: 'shield',
          targetIds: [enemy.id],
          label: `+${intent.value}`,
          value: intent.value,
          sound: 'guard',
        })
      } else if (intent.type === 'burn') {
        playerBurn += intent.value
        combatLog = pushLog(combatLog, `${enemy.name} inflicts ${intent.value} burn on you.`)
        lastEffect = nextEffect({
          kind: 'buff',
          targetIds: ['player'],
          label: `Burn +${intent.value}`,
          value: intent.value,
          sound: 'special',
        })
      } else if (intent.type === 'charge') {
        enemy = { ...enemy, charging: intent.value }
        combatLog = pushLog(combatLog, `${enemy.name} begins charging a devastating attack...`)
        lastEffect = nextEffect({
          kind: 'buff',
          targetIds: [enemy.id],
          label: 'Charging',
          sound: 'special',
        })
      }

      if (playerHp <= 0) {
        return {
          ...state,
          phase: 'defeat',
          playerHp: 0,
          playerBlock: 0,
          playerBurn: playerBurn,
          enemy,
          combatLog: pushLog(combatLog, 'The island keeps you. The run ends.'),
          lastEffect: nextEffect({ kind: 'defeat', targetIds: [], label: 'Defeated', sound: 'defeat' }),
        }
      }

      return startNewRound({
        ...state,
        playerHp,
        playerBlock,
        playerBurn,
        enemy,
        combatLog,
        lastEffect,
      })
    }

    case 'RESTART': {
      return { ...initialState }
    }

    default:
      return state
  }
}

export function useRunState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const availableCreatures = useMemo(() => ALL_CREATURES, [])

  return {
    state,
    dispatch,
    availableCreatures,
  }
}
