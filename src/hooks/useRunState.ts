import { useMemo, useReducer } from 'react'

import { ALL_CREATURES } from '../data/creatures'
import { describeComboResult, getManaCost, resolveCards } from '../data/combos'
import { ENEMY_TEMPLATES } from '../data/encounters'
import {
  PLAYER_MAX_HP,
  HAND_SIZE,
  HEAL_BETWEEN_FIGHTS,
  BASE_MANA,
  BANK_CAP,
  SURGE_BONUS,
  ENEMY_ACTION_MULTIPLIER,
  VULNERABLE_MULTIPLIER,
  shuffle,
  buildDeck,
  drawCards,
  drawEnemyCard,
  createEnemy,
  dealDamageToEnemy,
  dealDamageToPlayer,
} from '../engine/combat-engine'
import type {
  CombatEffect,
  CreatureTemplate,
  ElementCard,
  EnemyState,
  EnemyTemplate,
  GameAction,
  GameState,
  RelicId,
} from '../types'

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
  playerThorns: 0,
  playerRegen: 0,
  mana: 0,
  bankedMana: 0,
  hasSurge: false,
  cardsPlayedThisTurn: 0,
  encounters: [],
  encounterIndex: 0,
  enemy: null,
  selectedRelic: null,
  combatLog: [],
  lastEffect: null,
  stats: initialStats,
}

function pushLog(lines: string[], entry: string): string[] {
  return [...lines, entry].slice(-MAX_LOG_LINES)
}

let effectTick = 0
function nextEffect(effect: Omit<CombatEffect, 'tick'>): CombatEffect {
  effectTick += 1
  return { tick: effectTick, ...effect }
}

function advanceEncounter(state: GameState): GameState {
  const nextIndex = state.encounterIndex + 1

  if (nextIndex >= state.encounters.length) {
    return {
      ...state,
      phase: 'victory',
      combatLog: pushLog(state.combatLog, 'All enemies defeated. Victory!'),
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
    playerThorns: 0,
    playerRegen: 0,
    mana: BASE_MANA,
    bankedMana: 0,
    hasSurge: false,
    cardsPlayedThisTurn: 0,
    drawPile,
    discardPile,
    hand,
    selectedIndices: [],
    combatLog: pushLog(
      pushLog(state.combatLog, `${state.enemy?.name ?? 'The enemy'} falls.`),
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
  let { playerHp, playerBurn, playerRegen, enemy, combatLog } = state
  let lastEffect: CombatEffect | null = state.lastEffect

  let playerBlock = 0
  if (state.selectedRelic === 'stone-skin') {
    playerBlock = state.playerBlock
  }
  const playerThorns = 0

  // Wellspring relic: heal 2 at round start
  if (state.selectedRelic === 'wellspring') {
    const wellHeal = Math.min(2, state.playerMaxHp - playerHp)
    if (wellHeal > 0) {
      playerHp = Math.min(state.playerMaxHp, playerHp + 2)
      combatLog = pushLog(combatLog, `Wellspring restores ${wellHeal} HP.`)
    }
  }

  // Player regen tick
  if (playerRegen > 0) {
    const regenAmt = Math.min(playerRegen, state.playerMaxHp - playerHp)
    playerHp = Math.min(state.playerMaxHp, playerHp + playerRegen)
    if (regenAmt > 0) {
      combatLog = pushLog(combatLog, `You regenerate ${regenAmt} HP.`)
    }
    playerRegen = Math.max(0, playerRegen - 1)
  }

  // Player burn tick
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
      playerRegen: 0,
      playerThorns: 0,
      combatLog: pushLog(combatLog, 'You have been defeated.'),
      lastEffect: nextEffect({ kind: 'defeat', targetIds: [], label: 'Defeated', sound: 'defeat' }),
    }
  }

  // Enemy block resets
  if (enemy) {
    enemy = { ...enemy, block: 0 }
  }

  // Enemy regen tick
  if (enemy && enemy.regen > 0) {
    const regenAmt = Math.min(enemy.regen, enemy.maxHp - enemy.currentHp)
    enemy = {
      ...enemy,
      currentHp: Math.min(enemy.maxHp, enemy.currentHp + enemy.regen),
      regen: Math.max(0, enemy.regen - 1),
    }
    if (regenAmt > 0) {
      combatLog = pushLog(combatLog, `${enemy.name} regenerates ${regenAmt} HP.`)
    }
  }

  // Enemy burn tick
  if (enemy && enemy.burn > 0) {
    const burnDmg = enemy.burn
    const nextEnemyHp = Math.max(0, enemy.currentHp - burnDmg)
    combatLog = pushLog(combatLog, `${enemy.name} takes ${burnDmg} burn damage.`)

    const burnDecay = state.selectedRelic === 'ember-heart' ? 0 : 1
    enemy = {
      ...enemy,
      currentHp: nextEnemyHp,
      burn: Math.max(0, enemy.burn - burnDecay),
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
        playerThorns,
        playerRegen,
        enemy,
        combatLog,
        lastEffect,
      })
    }
  }

  // Vulnerable tick-down
  if (enemy && enemy.vulnerable > 0) {
    enemy = { ...enemy, vulnerable: Math.max(0, enemy.vulnerable - 1) }
  }

  // Discard remaining hand, draw a new hand
  const newDiscard = [...state.discardPile, ...state.hand]
  const { hand: newHand, drawPile, discardPile } = drawCards(state.drawPile, newDiscard, HAND_SIZE)

  // Enemy draws next card
  if (enemy) {
    const drawn = drawEnemyCard(enemy)
    enemy = { ...drawn.enemy, currentCard: drawn.card }
  }

  // Calculate mana for the new round
  const surgeMana = state.hasSurge ? SURGE_BONUS : 0
  const newMana = BASE_MANA + Math.min(state.bankedMana, BANK_CAP) + surgeMana

  return {
    ...state,
    playerHp,
    playerBlock,
    playerBurn,
    playerThorns,
    playerRegen,
    mana: newMana,
    bankedMana: 0,
    hasSurge: false,
    cardsPlayedThisTurn: 0,
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

      return {
        ...state,
        phase: 'teamSelect',
        team,
      }
    }

    case 'SELECT_RELIC': {
      const { team } = state
      if (team.length < 3) return state

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
        playerThorns: 0,
        playerRegen: 0,
        mana: BASE_MANA,
        bankedMana: 0,
        hasSurge: false,
        cardsPlayedThisTurn: 0,
        encounters,
        encounterIndex: 0,
        enemy: firstEnemy,
        selectedRelic: action.relicId,
        combatLog: [
          `Your team: ${teamNames}.`,
          `${firstEnemy.name} emerges.`,
        ],
        lastEffect: null,
        stats: initialStats,
      }
    }

    case 'TOGGLE_CARD': {
      if (state.phase !== 'combat') return state
      const idx = action.index
      if (idx < 0 || idx >= state.hand.length) return state

      const alreadySelected = state.selectedIndices.includes(idx)
      let selected: number[]

      if (alreadySelected) {
        selected = state.selectedIndices.filter((i) => i !== idx)
      } else {
        if (state.selectedIndices.length >= 2) {
          selected = [state.selectedIndices[1]!, idx]
        } else {
          selected = [...state.selectedIndices, idx]
        }
      }

      return { ...state, selectedIndices: selected }
    }

    case 'PLAY_CARDS': {
      if (state.phase !== 'combat' || !state.enemy || state.enemy.currentHp <= 0) return state
      if (state.selectedIndices.length === 0 || state.selectedIndices.length > 2) return state

      const selectedCards = state.selectedIndices.map((i) => state.hand[i]!)
      const cost = getManaCost(selectedCards)
      if (cost > state.mana) return state

      const result = resolveCards(selectedCards)
      if (!result) return state

      let enemy = { ...state.enemy }
      let { playerHp, playerBlock, playerBurn, playerThorns, playerRegen } = state
      let combatLog = state.combatLog
      let lastEffect: CombatEffect | null = null
      const parts: string[] = []

      // Apply damage
      if (result.damage) {
        let dmg = result.damage
        if (state.selectedRelic === 'glass-cannon') {
          dmg = Math.ceil(dmg * 1.5)
        }
        if (enemy.vulnerable > 0) {
          dmg = Math.ceil(dmg * VULNERABLE_MULTIPLIER)
        }
        const dmgResult = dealDamageToEnemy(enemy, dmg)
        enemy = dmgResult.enemy
        parts.push(`${dmgResult.dealt} damage${dmgResult.blocked > 0 ? ` (${dmgResult.blocked} blocked)` : ''}`)
        lastEffect = nextEffect({
          kind: 'damage',
          targetIds: [enemy.id],
          label: `-${dmgResult.dealt}`,
          value: dmgResult.dealt,
          sound: selectedCards.length >= 2 ? 'special' : 'hit',
          shake: dmgResult.dealt >= 8,
        })
      }

      // Apply block
      if (result.block) {
        playerBlock += result.block
        parts.push(`${result.block} block`)
        if (!lastEffect) {
          lastEffect = nextEffect({
            kind: 'shield',
            targetIds: ['player'],
            label: `+${result.block}`,
            value: result.block,
            sound: 'guard',
          })
        }
      }

      // Apply heal
      if (result.heal) {
        const healed = Math.min(result.heal, state.playerMaxHp - playerHp)
        playerHp = Math.min(state.playerMaxHp, playerHp + result.heal)
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

      // Apply burn to enemy
      if (result.burn) {
        enemy = { ...enemy, burn: enemy.burn + result.burn }
        parts.push(`${result.burn} burn`)
      }

      // Apply vulnerable to enemy
      if (result.vulnerable) {
        enemy = { ...enemy, vulnerable: enemy.vulnerable + result.vulnerable }
        parts.push(`${result.vulnerable} vulnerable`)
      }

      // Apply thorns to player
      if (result.thorns) {
        playerThorns += result.thorns
        parts.push(`${result.thorns} thorns`)
      }

      // Apply regen to player
      if (result.regen) {
        playerRegen += result.regen
        parts.push(`${result.regen} regen`)
      }

      // Apply cleanse
      if (result.cleanse) {
        const cleansed = Math.min(result.cleanse, playerBurn)
        playerBurn = Math.max(0, playerBurn - result.cleanse)
        if (cleansed > 0) parts.push(`cleansed ${cleansed} burn`)
      }

      const desc = describeComboResult(result)
      combatLog = pushLog(combatLog, `Played: ${desc}. (${cost} mana)`)

      const remainingHand = state.hand.filter((_, i) => !state.selectedIndices.includes(i))
      const usedCards = state.selectedIndices.map((i) => state.hand[i]!)
      const newDiscard = [...state.discardPile, ...usedCards]

      const nextState: GameState = {
        ...state,
        enemy,
        playerHp,
        playerBlock,
        playerBurn,
        playerThorns,
        playerRegen,
        mana: state.mana - cost,
        cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
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
      let { playerHp, playerBlock } = state
      const { playerBurn } = state
      let combatLog = state.combatLog
      let lastEffect: CombatEffect | null = null

      // Resolve enemy's current card
      const card = enemy.currentCard
      if (card) {
        const actionValue = card.value * ENEMY_ACTION_MULTIPLIER

        if (card.element === 'fire') {
          let dmg = actionValue
          if (state.selectedRelic === 'glass-cannon') {
            dmg = Math.ceil(dmg * 1.5)
          }
          const result = dealDamageToPlayer(playerHp, playerBlock, dmg)
          playerHp = result.playerHp
          playerBlock = result.playerBlock

          // Thorns: reflect damage back to enemy
          if (state.playerThorns > 0) {
            const thornsDmg = state.playerThorns
            enemy = {
              ...enemy,
              currentHp: Math.max(0, enemy.currentHp - thornsDmg),
            }
            combatLog = pushLog(combatLog, `Thorns deal ${thornsDmg} damage back.`)
          }

          combatLog = pushLog(
            combatLog,
            `${enemy.name} attacks for ${actionValue}${result.blocked > 0 ? ` (${result.blocked} blocked)` : ''} — ${result.dealt} damage.`,
          )
          lastEffect = nextEffect({
            kind: 'damage',
            targetIds: ['player'],
            label: `-${result.dealt}`,
            value: result.dealt,
            sound: 'hit',
            shake: result.dealt >= 8,
          })
        } else if (card.element === 'nature') {
          enemy = { ...enemy, block: enemy.block + actionValue }
          combatLog = pushLog(combatLog, `${enemy.name} braces, gaining ${actionValue} block.`)
          lastEffect = nextEffect({
            kind: 'shield',
            targetIds: [enemy.id],
            label: `+${actionValue}`,
            value: actionValue,
            sound: 'guard',
          })
        } else if (card.element === 'water') {
          const healed = Math.min(actionValue, enemy.maxHp - enemy.currentHp)
          enemy = {
            ...enemy,
            currentHp: Math.min(enemy.maxHp, enemy.currentHp + actionValue),
          }
          combatLog = pushLog(combatLog, `${enemy.name} heals for ${healed}.`)
          lastEffect = nextEffect({
            kind: 'heal',
            targetIds: [enemy.id],
            label: `+${healed}`,
            value: healed,
            sound: 'heal',
          })
        }

        // Move card to enemy discard
        enemy = {
          ...enemy,
          discardPile: [...enemy.discardPile, card],
          currentCard: null,
        }
      }

      // Tide Turner: deal banked mana as damage on pass
      if (state.selectedRelic === 'tide-turner' && state.cardsPlayedThisTurn === 0 && state.mana > 0) {
        const tideDmg = state.mana
        const tideResult = dealDamageToEnemy(enemy, tideDmg)
        enemy = tideResult.enemy
        combatLog = pushLog(combatLog, `Tide Turner deals ${tideResult.dealt} damage.`)
        lastEffect = nextEffect({
          kind: 'damage',
          targetIds: [enemy.id],
          label: `-${tideResult.dealt}`,
          value: tideResult.dealt,
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
          playerThorns: 0,
          playerRegen: 0,
          enemy,
          combatLog: pushLog(combatLog, 'You have been defeated.'),
          lastEffect: nextEffect({ kind: 'defeat', targetIds: [], label: 'Defeated', sound: 'defeat' }),
        }
      }

      if (enemy.currentHp <= 0) {
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

      // Bank remaining mana
      const newBankedMana = Math.min(state.mana, BANK_CAP)
      const hasSurge = state.cardsPlayedThisTurn === 0

      return startNewRound({
        ...state,
        playerHp,
        playerBlock,
        playerBurn,
        enemy,
        combatLog,
        lastEffect,
        bankedMana: newBankedMana,
        hasSurge,
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

export function getEnemyRemainingByElement(enemy: EnemyState): {
  fire: number[]; nature: number[]; water: number[]
} {
  const remaining = [...enemy.drawPile]
  if (enemy.currentCard) remaining.push(enemy.currentCard)

  return {
    fire: remaining.filter((c) => c.element === 'fire').map((c) => c.value).sort((a, b) => a - b),
    nature: remaining.filter((c) => c.element === 'nature').map((c) => c.value).sort((a, b) => a - b),
    water: remaining.filter((c) => c.element === 'water').map((c) => c.value).sort((a, b) => a - b),
  }
}

export function getIntentValueRange(
  enemy: EnemyState,
  relicId: RelicId | null,
): { type: 'attack' | 'block' | 'heal'; min: number; max: number; possibleValues: number[]; exactValue: number } | null {
  const card = enemy.currentCard
  if (!card) return null

  const intentType = card.element === 'fire' ? 'attack' as const
    : card.element === 'nature' ? 'block' as const
    : 'heal' as const

  const exactValue = card.value * ENEMY_ACTION_MULTIPLIER

  if (relicId === 'mirror-shard') {
    return { type: intentType, min: exactValue, max: exactValue, possibleValues: [exactValue], exactValue }
  }

  const remaining = enemy.drawPile.filter((c) => c.element === card.element)
  const allValues = [card.value, ...remaining.map((c) => c.value)]
    .map((v) => v * ENEMY_ACTION_MULTIPLIER)
    .sort((a, b) => a - b)

  const unique = [...new Set(allValues)]

  return {
    type: intentType,
    min: unique[0] ?? exactValue,
    max: unique[unique.length - 1] ?? exactValue,
    possibleValues: unique,
    exactValue,
  }
}
