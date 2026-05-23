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

  // Fun-signal additions
  cascadesByAuthorship: { player: number; enemy: number; mixed: number }
  bigSpellCasts: number
  abilityCasts: Record<string, number>
  avgDistinctChoicesPerTurn: number
  directDamageDealt: number
  directDamageTaken: number
  cascadeDamageDealt: number
  cascadeDamageTaken: number
  cascadeDamagePct: number
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

function zeroAuthorship(): { player: number; enemy: number; mixed: number } {
  return { player: 0, enemy: 0, mixed: 0 }
}

export function extractMetrics(result: GameResult): GameMetrics {
  const cascadesByType = { ...ZERO_REACTION }
  const terrainByElement = { ...ZERO_ELEMENT }
  const cascadesByAuthorship = zeroAuthorship()
  const winds = new Set<string>()
  let cascadesTriggered = 0
  let biggestCascadeSize = 0
  let cascadeDamageTotal = 0
  let totalDecisions = 0
  let decisionEventCount = 0

  let directDamageDealt = 0
  let directDamageTaken = 0
  let cascadeDamageDealt = 0
  let cascadeDamageTaken = 0

  const abilityCasts: Record<string, number> = {}
  let bigSpellCasts = 0
  let varianceTotal = 0
  let varianceCount = 0

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
        cascadesByAuthorship[e.authorship]++
        break
      case 'damage':
        if (e.source === 'cascade') {
          if (e.targetIsPlayer) cascadeDamageTaken += e.amount
          else cascadeDamageDealt += e.amount
        } else {
          if (e.targetIsPlayer) directDamageTaken += e.amount
          else directDamageDealt += e.amount
        }
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
      case 'abilityCast':
        abilityCasts[e.abilityId] = (abilityCasts[e.abilityId] ?? 0) + 1
        if (e.manaCost >= 3) bigSpellCasts++
        break
      case 'actionVariance':
        varianceTotal += e.distinctChoices
        varianceCount++
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

  const totalDamageDealt = directDamageDealt + cascadeDamageDealt
  const totalDamageTaken = directDamageTaken + cascadeDamageTaken
  const totalDamage = totalDamageDealt + totalDamageTaken
  const cascadeDamagePct =
    totalDamage > 0 ? (cascadeDamageDealt + cascadeDamageTaken) / totalDamage : 0
  const avgDistinctChoicesPerTurn = varianceCount > 0 ? varianceTotal / varianceCount : 0

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
    cascadesByAuthorship,
    bigSpellCasts,
    abilityCasts,
    avgDistinctChoicesPerTurn,
    directDamageDealt,
    directDamageTaken,
    cascadeDamageDealt,
    cascadeDamageTaken,
    cascadeDamagePct,
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

  // Fun-signal aggregates
  avgPlayerAuthoredCascadePct: number
  avgBigSpellCastsPerGame: number
  avgDistinctChoicesPerTurn: number
  avgCascadeDamagePct: number
  abilityCastsByName: Record<string, number>
  cascadeAuthorshipTotals: { player: number; enemy: number; mixed: number }
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
      avgPlayerAuthoredCascadePct: 0,
      avgBigSpellCastsPerGame: 0,
      avgDistinctChoicesPerTurn: 0,
      avgCascadeDamagePct: 0,
      abilityCastsByName: {},
      cascadeAuthorshipTotals: zeroAuthorship(),
    }
  }

  const wins = metrics.filter((m) => m.won).length
  const sum = (fn: (m: GameMetrics) => number) => metrics.reduce((s, m) => s + fn(m), 0)
  const cascadeMix = { ...ZERO_REACTION }
  const terrainMix = { ...ZERO_ELEMENT }
  const cascadeAuthorshipTotals = zeroAuthorship()
  const abilityCastsByName: Record<string, number> = {}

  for (const m of metrics) {
    for (const k of Object.keys(cascadeMix) as ReactionType[]) {
      cascadeMix[k] += m.cascadesByType[k]
    }
    for (const k of Object.keys(terrainMix) as Element[]) {
      terrainMix[k] += m.terrainPlacementsByElement[k]
    }
    cascadeAuthorshipTotals.player += m.cascadesByAuthorship.player
    cascadeAuthorshipTotals.enemy += m.cascadesByAuthorship.enemy
    cascadeAuthorshipTotals.mixed += m.cascadesByAuthorship.mixed
    for (const [abilityId, count] of Object.entries(m.abilityCasts)) {
      abilityCastsByName[abilityId] = (abilityCastsByName[abilityId] ?? 0) + count
    }
  }

  // Per-game player-authored share, averaged across games (skip games with no cascades)
  let authoredShareTotal = 0
  let authoredShareCount = 0
  for (const m of metrics) {
    const total =
      m.cascadesByAuthorship.player + m.cascadesByAuthorship.enemy + m.cascadesByAuthorship.mixed
    if (total > 0) {
      authoredShareTotal += m.cascadesByAuthorship.player / total
      authoredShareCount++
    }
  }
  const avgPlayerAuthoredCascadePct =
    authoredShareCount > 0 ? authoredShareTotal / authoredShareCount : 0

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
    avgPlayerAuthoredCascadePct,
    avgBigSpellCastsPerGame: sum((m) => m.bigSpellCasts) / metrics.length,
    avgDistinctChoicesPerTurn: sum((m) => m.avgDistinctChoicesPerTurn) / metrics.length,
    avgCascadeDamagePct: sum((m) => m.cascadeDamagePct) / metrics.length,
    abilityCastsByName,
    cascadeAuthorshipTotals,
  }
}
