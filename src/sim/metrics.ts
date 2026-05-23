import type { Element, ReactionType } from '../grid/types'
import type { GameEvent, GameResult } from './runner'

export interface GameMetrics {
  won: boolean
  turns: number
  endReason: 'victory' | 'defeat' | 'turnCap'

  playerHpRemaining: number
  enemyHpRemaining: number
  totalDamageDealt: number
  totalDamageTaken: number

  cascadesTriggered: number
  cascadesByType: Record<ReactionType, number>
  biggestCascadeSize: number
  cascadeDamageTotal: number

  terrainPlacementsByElement: Record<Element, number>
  decisionsBranchingFactor: number

  windDirectionsSeen: number
}

const ZERO_REACTION: Record<ReactionType, number> = {
  electrified: 0,
  steam: 0,
  plasma: 0,
  shatter: 0,
}

const ZERO_ELEMENT: Record<Element, number> = {
  water: 0,
  fire: 0,
  lightning: 0,
  earth: 0,
}

export function extractMetrics(result: GameResult): GameMetrics {
  const cascadesByType = { ...ZERO_REACTION }
  const terrainByElement = { ...ZERO_ELEMENT }
  const winds = new Set<string>()
  let cascadesTriggered = 0
  let biggestCascadeSize = 0
  let cascadeDamageTotal = 0
  let totalDamageDealt = 0
  let totalDamageTaken = 0
  let totalDecisions = 0
  let decisionEventCount = 0

  for (const e of result.events as GameEvent[]) {
    switch (e.type) {
      case 'turnStart':
        winds.add(e.wind)
        break
      case 'cascade':
        cascadesTriggered++
        cascadesByType[e.reactionType]++
        if (e.size > biggestCascadeSize) biggestCascadeSize = e.size
        cascadeDamageTotal += e.damage
        break
      case 'damage':
        if (e.targetIsPlayer) totalDamageTaken += e.amount
        else totalDamageDealt += e.amount
        break
      case 'terrainPlaced':
        if (e.placedBy === 'player') {
          terrainByElement[e.element] += e.tilesAdded
        }
        break
      case 'decisionCount':
        if (e.actorIsPlayer) {
          totalDecisions += e.legalActions
          decisionEventCount++
        }
        break
    }
  }

  const playerHpRemaining = result.finalState.playerChars.reduce(
    (s, c) => s + Math.max(0, c.currentHp),
    0,
  )
  const enemyHpRemaining = result.finalState.enemyChars.reduce(
    (s, c) => s + Math.max(0, c.currentHp),
    0,
  )

  return {
    won: result.outcome === 'victory',
    turns: result.turns,
    endReason: result.outcome,
    playerHpRemaining,
    enemyHpRemaining,
    totalDamageDealt,
    totalDamageTaken,
    cascadesTriggered,
    cascadesByType,
    biggestCascadeSize,
    cascadeDamageTotal,
    terrainPlacementsByElement: terrainByElement,
    decisionsBranchingFactor: decisionEventCount > 0 ? totalDecisions / decisionEventCount : 0,
    windDirectionsSeen: winds.size,
  }
}

export interface AggStats {
  games: number
  wins: number
  winRate: number
  avgTurns: number
  avgCascades: number
  avgCascadeDamage: number
  avgPlayerHpRemaining: number
  avgEnemyHpRemaining: number
  avgDamageDealt: number
  avgDamageTaken: number
  avgBranchingFactor: number
  cascadeMix: Record<ReactionType, number>
  terrainMix: Record<Element, number>
}

export function aggregate(metrics: GameMetrics[]): AggStats {
  if (metrics.length === 0) {
    return {
      games: 0,
      wins: 0,
      winRate: 0,
      avgTurns: 0,
      avgCascades: 0,
      avgCascadeDamage: 0,
      avgPlayerHpRemaining: 0,
      avgEnemyHpRemaining: 0,
      avgDamageDealt: 0,
      avgDamageTaken: 0,
      avgBranchingFactor: 0,
      cascadeMix: { ...ZERO_REACTION },
      terrainMix: { ...ZERO_ELEMENT },
    }
  }

  const wins = metrics.filter((m) => m.won).length
  const sum = (fn: (m: GameMetrics) => number) => metrics.reduce((s, m) => s + fn(m), 0)
  const cascadeMix = { ...ZERO_REACTION }
  const terrainMix = { ...ZERO_ELEMENT }
  for (const m of metrics) {
    for (const k of Object.keys(cascadeMix) as ReactionType[]) {
      cascadeMix[k] += m.cascadesByType[k]
    }
    for (const k of Object.keys(terrainMix) as Element[]) {
      terrainMix[k] += m.terrainPlacementsByElement[k]
    }
  }

  return {
    games: metrics.length,
    wins,
    winRate: wins / metrics.length,
    avgTurns: sum((m) => m.turns) / metrics.length,
    avgCascades: sum((m) => m.cascadesTriggered) / metrics.length,
    avgCascadeDamage: sum((m) => m.cascadeDamageTotal) / metrics.length,
    avgPlayerHpRemaining: sum((m) => m.playerHpRemaining) / metrics.length,
    avgEnemyHpRemaining: sum((m) => m.enemyHpRemaining) / metrics.length,
    avgDamageDealt: sum((m) => m.totalDamageDealt) / metrics.length,
    avgDamageTaken: sum((m) => m.totalDamageTaken) / metrics.length,
    avgBranchingFactor: sum((m) => m.decisionsBranchingFactor) / metrics.length,
    cascadeMix,
    terrainMix,
  }
}
