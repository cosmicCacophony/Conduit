import {
  applyCascadePhase,
  applyCleanupPhase,
  applyFlowPhase,
  assignCard,
  confirmAssignments,
  createInitialState,
  endActorTurn,
  executeAbility,
  type InitialStateOptions,
  moveCharacter,
  runEnemyTurn,
  selectAbility,
} from '../grid/engine'
import { detectCascades } from '../grid/cascade'
import type { BattleState, Element, ReactionType } from '../grid/types'
import { mulberry32 } from './random'
import { ALL_STRATEGIES, type Strategy } from './strategies'

export const DEFAULT_TURN_CAP = 30

export interface GameResult {
  seed: number
  strategyName: string
  enemyCompName: string
  outcome: 'victory' | 'defeat' | 'turnCap'
  turns: number
  finalState: BattleState
  events: GameEvent[]
}

export type GameEvent =
  | { type: 'turnStart'; turn: number; wind: BattleState['wind'] }
  | {
      type: 'cascade'
      turn: number
      reactionType: ReactionType
      size: number
      damage: number
      authorship: 'player' | 'enemy' | 'mixed'
    }
  | { type: 'damage'; turn: number; source: 'player' | 'enemy' | 'cascade'; amount: number; targetIsPlayer: boolean }
  | { type: 'terrainPlaced'; turn: number; element: Element; tilesAdded: number; placedBy: 'player' | 'enemy' }
  | { type: 'decisionCount'; turn: number; actorIsPlayer: boolean; legalActions: number }
  | { type: 'actionVariance'; turn: number; distinctChoices: number }
  | { type: 'abilityCast'; turn: number; abilityId: string; manaCost: number; byPlayer: true }

export interface RunOptions {
  seed: number
  strategy: Strategy
  enemyCompName?: string
  initialStateOptions?: InitialStateOptions
  turnCap?: number
}

function totalHp(chars: BattleState['playerChars']): number {
  return chars.reduce((sum, c) => sum + Math.max(0, c.currentHp), 0)
}

function countTerrainByElement(state: BattleState): Record<Element, number> {
  const counts: Record<Element, number> = { water: 0, fire: 0, lightning: 0, earth: 0 }
  for (const row of state.grid) {
    for (const tile of row) {
      if (tile.terrain) counts[tile.terrain.element]++
    }
  }
  return counts
}

function compareTerrain(before: BattleState, after: BattleState): Array<{ element: Element; tilesAdded: number }> {
  const b = countTerrainByElement(before)
  const a = countTerrainByElement(after)
  const out: Array<{ element: Element; tilesAdded: number }> = []
  for (const el of ['water', 'fire', 'lightning', 'earth'] as const) {
    const diff = a[el] - b[el]
    if (diff > 0) out.push({ element: el, tilesAdded: diff })
  }
  return out
}

export function playGame(opts: RunOptions): GameResult {
  const rng = mulberry32(opts.seed)
  const turnCap = opts.turnCap ?? DEFAULT_TURN_CAP
  const initialOptions: InitialStateOptions = {
    rng,
    ...(opts.initialStateOptions ?? {}),
  }
  let state = createInitialState(initialOptions)
  const events: GameEvent[] = []

  let safety = 0
  const maxIterations = turnCap * 50

  while (state.phase !== 'victory' && state.phase !== 'defeat') {
    safety++
    if (safety > maxIterations) {
      return {
        seed: opts.seed,
        strategyName: opts.strategy.name,
        enemyCompName: opts.enemyCompName ?? 'default',
        outcome: 'turnCap',
        turns: state.turnNumber,
        finalState: state,
        events,
      }
    }

    if (state.turnNumber > turnCap) {
      return {
        seed: opts.seed,
        strategyName: opts.strategy.name,
        enemyCompName: opts.enemyCompName ?? 'default',
        outcome: 'turnCap',
        turns: state.turnNumber,
        finalState: state,
        events,
      }
    }

    if (state.phase === 'assign') {
      events.push({ type: 'turnStart', turn: state.turnNumber, wind: state.wind })
      const assignment = opts.strategy.assign(state, rng)
      for (const [characterId, cardId] of Object.entries(assignment)) {
        state = assignCard(state, characterId, cardId)
      }
      // Fallback: any unassigned characters get random cards (avoid stuck state)
      const livingPlayers = state.playerChars.filter((c) => c.currentHp > 0)
      const usedCards = new Set(Object.values(state.assignments))
      const availableCards = state.hand.filter((c) => !usedCards.has(c.id))
      for (const char of livingPlayers) {
        if (state.assignments[char.id]) continue
        const card = availableCards.shift()
        if (card) state = assignCard(state, char.id, card.id)
      }
      state = confirmAssignments(state)
      continue
    }

    if (state.phase === 'action') {
      const actorId = state.currentActorId
      if (!actorId) {
        state = endActorTurn(state)
        continue
      }
      const actor = state.playerChars.find((c) => c.id === actorId)
      if (!actor || actor.currentHp <= 0) {
        state = endActorTurn(state)
        continue
      }

      // Move (optional)
      if (!actor.hasMoved) {
        const movePos = opts.strategy.selectMove(state, actor, rng)
        if (movePos) {
          state = moveCharacter(state, movePos)
        }
      }

      // Action (optional)
      const livingActor = state.playerChars.find((c) => c.id === actorId)
      if (livingActor && !livingActor.hasActed) {
        const actionsBefore = countLegalActions(state, livingActor)
        events.push({
          type: 'decisionCount',
          turn: state.turnNumber,
          actorIsPlayer: true,
          legalActions: actionsBefore,
        })

        // Action-variance probe across all 5 strategies (read-only).
        // Each probe gets its own seeded rng so the main game rng isn't consumed.
        {
          const probes = new Set<string>()
          for (let i = 0; i < ALL_STRATEGIES.length; i++) {
            const probeRng = mulberry32(opts.seed + state.turnNumber * 100 + i)
            const probe = ALL_STRATEGIES[i].selectAction(state, livingActor, probeRng)
            probes.add(probe ? `${probe.abilityId}@${probe.target.x},${probe.target.y}` : 'null')
          }
          events.push({
            type: 'actionVariance',
            turn: state.turnNumber,
            distinctChoices: probes.size,
          })
        }

        const choice = opts.strategy.selectAction(state, livingActor, rng)
        if (choice) {
          const before = state
          state = selectAbility(state, choice.abilityId)
          state = executeAbility(state, choice.target)
          if (state !== before) {
            const placed = compareTerrain(before, state)
            for (const p of placed) {
              events.push({
                type: 'terrainPlaced',
                turn: state.turnNumber,
                element: p.element,
                tilesAdded: p.tilesAdded,
                placedBy: 'player',
              })
            }
            const enemyHpBefore = totalHp(before.enemyChars)
            const enemyHpAfter = totalHp(state.enemyChars)
            if (enemyHpAfter < enemyHpBefore) {
              events.push({
                type: 'damage',
                turn: state.turnNumber,
                source: 'player',
                amount: enemyHpBefore - enemyHpAfter,
                targetIsPlayer: false,
              })
            }
            const ability = livingActor.abilities.find((a) => a.id === choice.abilityId)
            if (ability) {
              events.push({
                type: 'abilityCast',
                turn: state.turnNumber,
                abilityId: choice.abilityId,
                manaCost: ability.manaCost,
                byPlayer: true,
              })
            }
          }
        }
      }

      state = endActorTurn(state)
      continue
    }

    if (state.phase === 'enemy') {
      const before = state
      state = runEnemyTurn(state)
      const placed = compareTerrain(before, state)
      for (const p of placed) {
        events.push({
          type: 'terrainPlaced',
          turn: state.turnNumber,
          element: p.element,
          tilesAdded: p.tilesAdded,
          placedBy: 'enemy',
        })
      }
      const playerHpBefore = totalHp(before.playerChars)
      const playerHpAfter = totalHp(state.playerChars)
      if (playerHpAfter < playerHpBefore) {
        events.push({
          type: 'damage',
          turn: state.turnNumber,
          source: 'enemy',
          amount: playerHpBefore - playerHpAfter,
          targetIsPlayer: true,
        })
      }
      continue
    }

    if (state.phase === 'flow') {
      state = applyFlowPhase(state)
      continue
    }

    if (state.phase === 'cascade') {
      const beforeReactions = detectCascades(state.grid).reactions
      const before = state
      state = applyCascadePhase(state)
      for (const r of beforeReactions) {
        const placedBys: Array<'player' | 'enemy'> = []
        for (const p of [...r.primaryTiles, ...r.secondaryTiles]) {
          const t = before.grid[p.y]?.[p.x]?.terrain
          if (t?.placedBy) placedBys.push(t.placedBy)
        }
        let authorship: 'player' | 'enemy' | 'mixed'
        if (placedBys.length === 0) authorship = 'mixed'
        else if (placedBys.every((x) => x === 'player')) authorship = 'player'
        else if (placedBys.every((x) => x === 'enemy')) authorship = 'enemy'
        else authorship = 'mixed'
        events.push({
          type: 'cascade',
          turn: state.turnNumber,
          reactionType: r.type,
          size: r.primaryTiles.length + r.secondaryTiles.length,
          damage: r.damage,
          authorship,
        })
      }
      const playerHpBefore = totalHp(before.playerChars)
      const enemyHpBefore = totalHp(before.enemyChars)
      const playerHpAfter = totalHp(state.playerChars)
      const enemyHpAfter = totalHp(state.enemyChars)
      const cascadePlayerDmg = playerHpBefore - playerHpAfter
      const cascadeEnemyDmg = enemyHpBefore - enemyHpAfter
      if (cascadePlayerDmg > 0) {
        events.push({
          type: 'damage',
          turn: state.turnNumber,
          source: 'cascade',
          amount: cascadePlayerDmg,
          targetIsPlayer: true,
        })
      }
      if (cascadeEnemyDmg > 0) {
        events.push({
          type: 'damage',
          turn: state.turnNumber,
          source: 'cascade',
          amount: cascadeEnemyDmg,
          targetIsPlayer: false,
        })
      }
      continue
    }

    if (state.phase === 'cleanup') {
      state = applyCleanupPhase(state, rng)
      continue
    }
  }

  return {
    seed: opts.seed,
    strategyName: opts.strategy.name,
    enemyCompName: opts.enemyCompName ?? 'default',
    outcome: state.phase === 'victory' ? 'victory' : 'defeat',
    turns: state.turnNumber,
    finalState: state,
    events,
  }
}

function countLegalActions(state: BattleState, actor: BattleState['playerChars'][number]): number {
  // Branching factor: number of distinct (ability, target) pairs available, including end-turn (1).
  let count = 1
  for (const ability of actor.abilities) {
    if (ability.manaCost > actor.mana) continue
    if (ability.selfTarget) {
      count += 1
      continue
    }
    // Cell count within range (using Manhattan range like getAbilityTargets)
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const dist = Math.abs(x - actor.position.x) + Math.abs(y - actor.position.y)
        if (dist <= ability.range) count++
      }
    }
  }
  return count
}
