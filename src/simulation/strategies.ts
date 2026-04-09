import { getManaCost, resolveCards } from '../data/combos'
import { BASE_MANA, VULNERABLE_MULTIPLIER } from '../engine/combat-engine'
import type { PlayerAction, SimState } from './combat-sim'

type StrategyFn = (state: SimState) => PlayerAction

/**
 * Enumerate all legal plays (single card or pair) and return the one
 * with the highest score according to a scoring function.
 */
function findBestPlay(
  state: SimState,
  scoreFn: (indices: number[], state: SimState) => number,
): number[] | null {
  const { hand, mana } = state
  let bestScore = -1
  let bestIndices: number[] | null = null

  for (let i = 0; i < hand.length; i++) {
    if (hand[i]!.value > mana) continue
    const s = scoreFn([i], state)
    if (s > bestScore) { bestScore = s; bestIndices = [i] }
  }

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[i]!.value + hand[j]!.value > mana) continue
      const s = scoreFn([i, j], state)
      if (s > bestScore) { bestScore = s; bestIndices = [i, j] }
    }
  }

  return bestIndices
}

function damageScore(indices: number[], state: SimState): number {
  const cards = indices.map((i) => state.hand[i]!)
  const result = resolveCards(cards)
  if (!result) return -1
  return (result.damage ?? 0) + (result.burn ?? 0) * 2
}

function defenseScore(indices: number[], state: SimState): number {
  const cards = indices.map((i) => state.hand[i]!)
  const result = resolveCards(cards)
  if (!result) return -1
  return (result.block ?? 0) * 3 + (result.heal ?? 0) * 2 + (result.damage ?? 0)
}

function bestPossibleDamage(state: SimState): number {
  const best = findBestPlay(state, damageScore)
  if (!best) return 0
  const cards = best.map((i) => state.hand[i]!)
  const result = resolveCards(cards)
  return result?.damage ?? 0
}

function enemyHasElementInDraw(state: SimState, element: 'fire' | 'nature' | 'water'): boolean {
  return state.enemy.drawPile.some((c) => c.element === element)
}

// ---------------------------------------------------------------------------
// Split-resolution combat flow:
//   - nature/water resolve at START → enemy has block or already healed
//   - fire is PENDING → resolves after player acts, player can block
//
// The strategy sees `state.enemyIntent`:
//   'nature' → enemy has block, attacking is wasteful (PASS WINDOW)
//   'water'  → enemy already healed, attack to offset (ATTACK WINDOW)
//   'fire'   → enemy WILL attack after you act (DEFEND + ATTACK)
// ---------------------------------------------------------------------------

/**
 * Naive: always plays maximum damage. Never blocks or passes.
 * Wastes damage into enemy block on nature turns.
 */
export const naiveStrategy: StrategyFn = (state) => {
  const play = findBestPlay(state, damageScore)
  if (play) return { type: 'play', indices: play }
  return { type: 'end_turn' }
}

/**
 * Reactive: reads enemy intent and responds.
 * - Nature (enemy has block): pass — damage would be wasted.
 * - Water (enemy healed): attack with max damage — no block, offset heal.
 * - Fire (attack pending): block first, then damage with leftover mana.
 */
export const reactiveStrategy: StrategyFn = (state) => {
  const intent = state.enemyIntent

  if (intent === 'nature') {
    return { type: 'end_turn' }
  }

  if (intent === 'fire' && state.cardsPlayedThisTurn === 0) {
    const defense = findBestPlay(state, defenseScore)
    if (defense) return { type: 'play', indices: defense }
  }

  const atk = findBestPlay(state, damageScore)
  if (atk) return { type: 'play', indices: atk }
  return { type: 'end_turn' }
}

/**
 * Banking: like Reactive (passes nature turns, blocks fire turns),
 * but also passes weak hands on water turns for a bigger burst
 * when block is down.
 */
export const bankingStrategy: StrategyFn = (state) => {
  const intent = state.enemyIntent

  // Nature: pass (enemy has block)
  if (intent === 'nature') {
    return { type: 'end_turn' }
  }

  // Fire: block first, then damage
  if (intent === 'fire' && state.cardsPlayedThisTurn === 0) {
    const defense = findBestPlay(state, defenseScore)
    if (defense) return { type: 'play', indices: defense }
  }

  // Water or fire (after blocking): pass weak hands for surge
  if (state.cardsPlayedThisTurn === 0 && state.mana <= BASE_MANA) {
    const bestDmg = bestPossibleDamage(state)
    if (bestDmg <= 3) {
      return { type: 'end_turn' }
    }
  }

  const atk = findBestPlay(state, damageScore)
  if (atk) return { type: 'play', indices: atk }
  return { type: 'end_turn' }
}

/**
 * Tracker: like Banking, but tracks enemy discard pile.
 * - Always blocks on fire turns (like Reactive).
 * - On water turns: if enemy has no nature left in draw pile, attacks
 *   more aggressively (knows the next non-fire turn is also block-free).
 * - Passes more precisely: only on nature turns or when hand is weak
 *   AND there's no immediate scoring opportunity.
 */
export const trackerStrategy: StrategyFn = (state) => {
  const intent = state.enemyIntent
  const enemyHasNatureLeft = enemyHasElementInDraw(state, 'nature')

  // Nature: always pass (enemy has block)
  if (intent === 'nature') {
    return { type: 'end_turn' }
  }

  // Fire: block first, then damage (always block)
  if (intent === 'fire' && state.cardsPlayedThisTurn === 0) {
    const defense = findBestPlay(state, defenseScore)
    if (defense) return { type: 'play', indices: defense }
  }

  // Water/fire (after blocking): if enemy has no nature left, we know
  // upcoming turns are block-free → every point of damage lands.
  // Attack aggressively even with weaker hands.
  if (!enemyHasNatureLeft) {
    const atk = findBestPlay(state, damageScore)
    if (atk) return { type: 'play', indices: atk }
    return { type: 'end_turn' }
  }

  // Enemy still has nature cards: pass weak hands for burst on block-free turns
  if (state.cardsPlayedThisTurn === 0 && state.mana <= BASE_MANA) {
    const bestDmg = bestPossibleDamage(state)
    if (bestDmg <= 3) {
      return { type: 'end_turn' }
    }
  }

  const atk = findBestPlay(state, damageScore)
  if (atk) return { type: 'play', indices: atk }
  return { type: 'end_turn' }
}

/**
 * Score plays accounting for the vulnerable multiplier on the enemy.
 * On water turns: values Siphon (damage + vuln) when enemy isn't debuffed.
 * During vuln window: maximizes raw damage to exploit the 1.5x multiplier.
 */
function aggroDamageScore(indices: number[], state: SimState): number {
  const cards = indices.map((i) => state.hand[i]!)
  const result = resolveCards(cards)
  if (!result) return -1
  let score = 0
  let dmg = result.damage ?? 0
  if (state.enemy.vulnerable > 0) dmg = Math.ceil(dmg * VULNERABLE_MULTIPLIER)
  score += dmg
  if (result.vulnerable && state.enemy.vulnerable === 0) {
    score += result.vulnerable * 4
  }
  score += (result.burn ?? 0) * 2
  return score
}

/**
 * Aggro: two-phase playstyle modeled on StS Act 1 aggression.
 *
 * Setup phase (enemy not vulnerable):
 * - Water turns: play Siphon to apply vuln + deal damage.
 * - Nature turns: pass to bank mana.
 * - Fire turns: block first, then damage.
 *
 * Capitalize phase (enemy IS vulnerable):
 * - Nature turns: attack through block — 1.5x makes partial damage huge
 *   (e.g., 10*1.5 = 15 minus 6 block = 9 net damage).
 * - Water/fire turns: maximize damage to exploit the 1.5x window.
 */
export const aggroStrategy: StrategyFn = (state) => {
  const intent = state.enemyIntent

  if (intent === 'fire' && state.cardsPlayedThisTurn === 0) {
    const defense = findBestPlay(state, defenseScore)
    if (defense) return { type: 'play', indices: defense }
  }

  if (intent === 'nature') {
    if (state.enemy.vulnerable > 0) {
      const play = findBestPlay(state, aggroDamageScore)
      if (play) {
        const cards = play.map((i) => state.hand[i]!)
        const result = resolveCards(cards)
        let dmg = result?.damage ?? 0
        if (dmg > 0) dmg = Math.ceil(dmg * VULNERABLE_MULTIPLIER)
        if (dmg > state.enemy.block) {
          return { type: 'play', indices: play }
        }
      }
    }
    return { type: 'end_turn' }
  }

  const play = findBestPlay(state, aggroDamageScore)
  if (play) return { type: 'play', indices: play }
  return { type: 'end_turn' }
}

export const ALL_STRATEGIES: { name: string; fn: StrategyFn }[] = [
  { name: 'Naive', fn: naiveStrategy },
  { name: 'Reactive', fn: reactiveStrategy },
  { name: 'Banking', fn: bankingStrategy },
  { name: 'Tracker', fn: trackerStrategy },
  { name: 'Aggro', fn: aggroStrategy },
]
