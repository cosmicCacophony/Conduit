import {
  PLAYER_MAX_HP,
  HAND_SIZE,
  BASE_MANA,
  BANK_CAP,
  SURGE_BONUS,
  ENEMY_ACTION_MULTIPLIER,
  VULNERABLE_MULTIPLIER,
  shuffle,
  drawCards,
  drawEnemyCard,
  createEnemy,
  dealDamageToEnemy,
  dealDamageToPlayer,
} from '../engine/combat-engine'
import { getManaCost, resolveCards } from '../data/combos'
import type { Element, ElementCard, EnemyState, EnemyTemplate, RelicId } from '../types'

export interface SimState {
  playerHp: number
  playerMaxHp: number
  playerBlock: number
  playerBurn: number
  playerThorns: number
  playerRegen: number
  mana: number
  bankedMana: number
  hasSurge: boolean
  cardsPlayedThisTurn: number
  hand: ElementCard[]
  drawPile: ElementCard[]
  discardPile: ElementCard[]
  enemy: EnemyState
  relic: RelicId | null
  /**
   * The element of the enemy's current card (visible as intent).
   * For nature/water this has already resolved (enemy has block / healed).
   * For fire the attack is pending — it resolves AFTER the player acts.
   */
  enemyIntent: Element | null
  /** How many times the enemy has reshuffled its deck (fire scales +1 per cycle) */
  enemyDeckCycle: number
}

export type PlayerAction =
  | { type: 'play'; indices: number[] }
  | { type: 'end_turn' }

export type Strategy = (state: SimState) => PlayerAction

export interface SimResult {
  turns: number
  hpLost: number
  damageDealt: number
  passesUsed: number
  won: boolean
}

const MAX_TURNS = 50

export function simulateCombat(
  playerDeck: ElementCard[],
  enemyTemplate: EnemyTemplate,
  strategy: Strategy,
  relic: RelicId | null = null,
): SimResult {
  const enemy = createEnemy(enemyTemplate)
  const shuffled = shuffle([...playerDeck])
  const { hand, drawPile, discardPile } = drawCards(shuffled, [], HAND_SIZE)

  const state: SimState = {
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
    hand,
    drawPile,
    discardPile,
    enemy,
    relic,
    enemyIntent: null,
    enemyDeckCycle: 0,
  }

  let turns = 0
  let totalDamageDealt = 0
  let passesUsed = 0
  const startHp = state.playerHp

  while (turns < MAX_TURNS) {
    turns++

    // =================================================================
    // PHASE 1: Enemy intent — nature/water resolve NOW, fire is pending
    // =================================================================
    const card = state.enemy.currentCard
    state.enemyIntent = card?.element ?? null

    if (card) {
      if (card.element === 'nature') {
        const actionValue = card.value * ENEMY_ACTION_MULTIPLIER
        state.enemy = { ...state.enemy, block: state.enemy.block + actionValue }
      } else if (card.element === 'water') {
        const actionValue = card.value * ENEMY_ACTION_MULTIPLIER
        state.enemy = {
          ...state.enemy,
          currentHp: Math.min(state.enemy.maxHp, state.enemy.currentHp + actionValue),
        }
      }
    }

    // =================================================================
    // PHASE 2: Player plays cards
    // =================================================================
    let endedTurn = false
    let actionsThisTurn = 0
    const maxActionsPerTurn = 20

    while (!endedTurn && actionsThisTurn < maxActionsPerTurn) {
      actionsThisTurn++
      const action = strategy(state)

      if (action.type === 'play') {
        const cards = action.indices.map((i) => state.hand[i]!)
        if (cards.length === 0 || cards.length > 2) {
          endedTurn = true
          break
        }
        const cost = getManaCost(cards)
        if (cost > state.mana) {
          endedTurn = true
          break
        }
        const result = resolveCards(cards)
        if (!result) {
          endedTurn = true
          break
        }

        if (result.damage) {
          let dmg = result.damage
          if (state.relic === 'glass-cannon') dmg = Math.ceil(dmg * 1.5)
          if (state.enemy.vulnerable > 0) dmg = Math.ceil(dmg * VULNERABLE_MULTIPLIER)
          const dmgResult = dealDamageToEnemy(state.enemy, dmg)
          state.enemy = dmgResult.enemy
          totalDamageDealt += dmgResult.dealt
        }
        if (result.block) state.playerBlock += result.block
        if (result.heal) {
          state.playerHp = Math.min(state.playerMaxHp, state.playerHp + result.heal)
        }
        if (result.burn) state.enemy = { ...state.enemy, burn: state.enemy.burn + result.burn }
        if (result.vulnerable) {
          state.enemy = { ...state.enemy, vulnerable: state.enemy.vulnerable + result.vulnerable }
        }
        if (result.thorns) state.playerThorns += result.thorns
        if (result.regen) state.playerRegen += result.regen
        if (result.cleanse) {
          state.playerBurn = Math.max(0, state.playerBurn - result.cleanse)
        }

        state.mana -= cost
        state.cardsPlayedThisTurn++

        const remaining = state.hand.filter((_, i) => !action.indices.includes(i))
        const used = action.indices.map((i) => state.hand[i]!)
        state.discardPile = [...state.discardPile, ...used]
        state.hand = remaining

        if (state.enemy.currentHp <= 0) {
          return { turns, hpLost: startHp - state.playerHp, damageDealt: totalDamageDealt, passesUsed, won: true }
        }
      } else {
        endedTurn = true
      }
    }

    if (state.cardsPlayedThisTurn === 0) passesUsed++

    // =================================================================
    // PHASE 3: Enemy fire resolves AFTER player acts (player can block)
    // =================================================================
    if (card) {
      if (card.element === 'fire') {
        const scaledValue = card.value + state.enemyDeckCycle
        const actionValue = scaledValue * ENEMY_ACTION_MULTIPLIER
        let dmg = actionValue
        if (state.relic === 'glass-cannon') dmg = Math.ceil(dmg * 1.5)
        const result = dealDamageToPlayer(state.playerHp, state.playerBlock, dmg)
        state.playerHp = result.playerHp
        state.playerBlock = result.playerBlock
        if (state.playerThorns > 0) {
          state.enemy = {
            ...state.enemy,
            currentHp: Math.max(0, state.enemy.currentHp - state.playerThorns),
          }
        }
      }

      // Move enemy card to discard
      state.enemy = {
        ...state.enemy,
        discardPile: [...state.enemy.discardPile, card],
        currentCard: null,
      }
    }

    // Tide Turner: deal damage on pass
    if (state.relic === 'tide-turner' && state.cardsPlayedThisTurn === 0 && state.mana > 0) {
      const tideResult = dealDamageToEnemy(state.enemy, state.mana)
      state.enemy = tideResult.enemy
      totalDamageDealt += tideResult.dealt
    }

    if (state.playerHp <= 0) {
      return { turns, hpLost: startHp, damageDealt: totalDamageDealt, passesUsed, won: false }
    }
    if (state.enemy.currentHp <= 0) {
      return { turns, hpLost: startHp - state.playerHp, damageDealt: totalDamageDealt, passesUsed, won: true }
    }

    // =================================================================
    // PHASE 4: End-of-round cleanup
    // =================================================================
    const newBankedMana = Math.min(state.mana, BANK_CAP)
    const hasSurge = state.cardsPlayedThisTurn === 0

    // Player block and thorns reset
    state.playerBlock = state.relic === 'stone-skin' ? state.playerBlock : 0
    state.playerThorns = 0

    // Wellspring relic
    if (state.relic === 'wellspring') {
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 2)
    }

    // Player regen/burn
    if (state.playerRegen > 0) {
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + state.playerRegen)
      state.playerRegen = Math.max(0, state.playerRegen - 1)
    }
    if (state.playerBurn > 0) {
      state.playerHp = Math.max(0, state.playerHp - state.playerBurn)
      state.playerBurn = Math.max(0, state.playerBurn - 1)
    }
    if (state.playerHp <= 0) {
      return { turns, hpLost: startHp, damageDealt: totalDamageDealt, passesUsed, won: false }
    }

    // Enemy block resets, vulnerable ticks down
    state.enemy = {
      ...state.enemy,
      block: 0,
      vulnerable: Math.max(0, state.enemy.vulnerable - 1),
    }

    // Enemy regen/burn
    if (state.enemy.regen > 0) {
      state.enemy = {
        ...state.enemy,
        currentHp: Math.min(state.enemy.maxHp, state.enemy.currentHp + state.enemy.regen),
        regen: Math.max(0, state.enemy.regen - 1),
      }
    }
    if (state.enemy.burn > 0) {
      const burnDmg = state.enemy.burn
      state.enemy = {
        ...state.enemy,
        currentHp: Math.max(0, state.enemy.currentHp - burnDmg),
        burn: Math.max(0, state.enemy.burn - (state.relic === 'ember-heart' ? 0 : 1)),
      }
      if (state.enemy.currentHp <= 0) {
        return { turns, hpLost: startHp - state.playerHp, damageDealt: totalDamageDealt, passesUsed, won: true }
      }
    }

    // Discard hand, draw new hand
    state.discardPile = [...state.discardPile, ...state.hand]
    const drawn = drawCards(state.drawPile, state.discardPile, HAND_SIZE)
    state.hand = drawn.hand
    state.drawPile = drawn.drawPile
    state.discardPile = drawn.discardPile

    // Enemy draws next card (intent for next round)
    // Detect deck cycle: if draw pile is empty before drawing, a reshuffle is about to happen
    const willReshuffle = state.enemy.drawPile.length === 0 && state.enemy.discardPile.length > 0
    const enemyDraw = drawEnemyCard(state.enemy)
    state.enemy = { ...enemyDraw.enemy, currentCard: enemyDraw.card }
    if (willReshuffle) state.enemyDeckCycle++

    const surgeMana = hasSurge ? SURGE_BONUS : 0
    state.mana = BASE_MANA + Math.min(newBankedMana, BANK_CAP) + surgeMana
    state.bankedMana = 0
    state.hasSurge = false
    state.cardsPlayedThisTurn = 0
  }

  return { turns: MAX_TURNS, hpLost: startHp - state.playerHp, damageDealt: totalDamageDealt, passesUsed, won: false }
}
