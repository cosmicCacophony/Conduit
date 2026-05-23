import type { TournamentResult } from './tournament'
import { ALL_STRATEGIES } from './strategies'

export type Verdict = 'good' | 'flat' | 'dominant' | 'lopsided'

export interface VarianceReport {
  dominantStrategy: string | null
  weakStrategy: string | null
  coverageScore: Record<string, number>
  pairwiseSpread: number
  conditionDiversity: number
  verdict: Verdict
  notes: string[]
}

const DOMINANT_THRESHOLD = 0.7
const WEAK_THRESHOLD = 0.3
const COVERAGE_WIN_THRESHOLD = 0.5
const FLAT_SPREAD_THRESHOLD = 0.08
const FLAT_DIVERSITY_THRESHOLD = 0.05

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function analyzeVariance(result: TournamentResult): VarianceReport {
  const allNames = Object.keys(result.matrix)
  const baselineNames = new Set(
    (result.config.strategies ?? ALL_STRATEGIES).filter((s) => s.isBaseline).map((s) => s.name),
  )
  const judgedNames = allNames.filter((n) => !baselineNames.has(n))
  const compNames = result.config.enemyComps.map((c) => c.name)

  // Win-rate matrix
  const wr: Record<string, Record<string, number>> = {}
  for (const s of allNames) {
    wr[s] = {}
    for (const c of compNames) {
      wr[s][c] = result.matrix[s][c]?.winRate ?? 0
    }
  }

  // Dominant: strategy whose minimum across conditions exceeds threshold
  let dominantStrategy: string | null = null
  for (const s of judgedNames) {
    const rates = compNames.map((c) => wr[s][c])
    if (rates.length > 0 && Math.min(...rates) >= DOMINANT_THRESHOLD) {
      dominantStrategy = s
      break
    }
  }

  // Weak: strategy whose max across conditions is below threshold
  let weakStrategy: string | null = null
  for (const s of judgedNames) {
    const rates = compNames.map((c) => wr[s][c])
    if (rates.length > 0 && Math.max(...rates) <= WEAK_THRESHOLD) {
      weakStrategy = s
      break
    }
  }

  // Coverage score: count of conditions where strategy has >= 50% win rate
  // (computed for ALL strategies, including baselines, for visibility)
  const coverageScore: Record<string, number> = {}
  for (const s of allNames) {
    coverageScore[s] = compNames.filter((c) => wr[s][c] >= COVERAGE_WIN_THRESHOLD).length
  }

  // Pairwise spread: avg std-dev of win rates across non-baseline strategies WITHIN each condition
  const perConditionSpreads: number[] = []
  for (const c of compNames) {
    const rates = judgedNames.map((s) => wr[s][c])
    perConditionSpreads.push(stdDev(rates))
  }
  const pairwiseSpread =
    perConditionSpreads.reduce((s, v) => s + v, 0) / Math.max(1, perConditionSpreads.length)

  // Condition diversity: avg std-dev of a strategy's win rate ACROSS conditions
  const perStrategyDiversity: number[] = []
  for (const s of judgedNames) {
    const rates = compNames.map((c) => wr[s][c])
    perStrategyDiversity.push(stdDev(rates))
  }
  const conditionDiversity =
    perStrategyDiversity.reduce((s, v) => s + v, 0) / Math.max(1, perStrategyDiversity.length)

  // Verdict
  let verdict: Verdict
  const notes: string[] = []
  if (dominantStrategy) {
    verdict = 'dominant'
    notes.push(`${dominantStrategy} wins ≥70% across all conditions — design likely broken (OP).`)
  } else if (weakStrategy) {
    verdict = 'lopsided'
    notes.push(`${weakStrategy} loses ≥70% across all conditions — design likely broken (weak).`)
  } else if (
    pairwiseSpread < FLAT_SPREAD_THRESHOLD &&
    conditionDiversity < FLAT_DIVERSITY_THRESHOLD
  ) {
    verdict = 'flat'
    notes.push('Strategies have nearly identical win rates everywhere — game lacks variance.')
  } else {
    verdict = 'good'
    const viable = judgedNames.filter((s) => coverageScore[s] > 0).length
    notes.push(`${viable}/${judgedNames.length} non-baseline strategies are viable in at least one condition.`)
    if (conditionDiversity > 0.1) {
      notes.push('Strategies meaningfully shift across conditions — wind / enemy comp matters.')
    }
  }
  if (baselineNames.size > 0) {
    notes.push(`Baseline strategies excluded from verdict thresholds: ${[...baselineNames].join(', ')}.`)
  }

  return {
    dominantStrategy,
    weakStrategy,
    coverageScore,
    pairwiseSpread,
    conditionDiversity,
    verdict,
    notes,
  }
}
