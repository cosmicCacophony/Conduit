import { aggregate, extractMetrics, type AggStats, type GameMetrics } from './metrics'
import { playGame } from './runner'
import { ALL_STRATEGIES, type Strategy } from './strategies'

export interface EnemyComposition {
  name: string
  enemyTemplateIds: string[]
}

export const DEFAULT_ENEMY_COMPS: EnemyComposition[] = [
  { name: 'Mixed', enemyTemplateIds: ['storm-sprite', 'ember-wisp', 'tide-spirit'] },
  { name: 'Fire Trio', enemyTemplateIds: ['ember-wisp', 'ember-wisp', 'storm-sprite'] },
  { name: 'Water Trio', enemyTemplateIds: ['tide-spirit', 'tide-spirit', 'storm-sprite'] },
  { name: 'Storm Trio', enemyTemplateIds: ['storm-sprite', 'storm-sprite', 'ember-wisp'] },
]

export interface TournamentConfig {
  strategies: Strategy[]
  enemyComps: EnemyComposition[]
  seedsPerMatchup: number
  baseSeed: number
  turnCap?: number
}

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  strategies: ALL_STRATEGIES,
  enemyComps: DEFAULT_ENEMY_COMPS,
  seedsPerMatchup: 200,
  baseSeed: 12345,
}

export interface TournamentResult {
  config: TournamentConfig
  durationMs: number
  totalGames: number
  matrix: Record<string, Record<string, AggStats>>
  perGame: GameMetrics[]
  perGameMeta: Array<{ strategy: string; enemyComp: string; seed: number }>
}

export interface ProgressCallback {
  (done: number, total: number): void
}

export function runTournament(
  config: TournamentConfig = DEFAULT_TOURNAMENT_CONFIG,
  onProgress?: ProgressCallback,
): TournamentResult {
  const start = Date.now()
  const matrix: Record<string, Record<string, AggStats>> = {}
  const perGame: GameMetrics[] = []
  const perGameMeta: Array<{ strategy: string; enemyComp: string; seed: number }> = []

  const total = config.strategies.length * config.enemyComps.length * config.seedsPerMatchup
  let done = 0

  for (const strategy of config.strategies) {
    matrix[strategy.name] = {}
    for (const comp of config.enemyComps) {
      const games: GameMetrics[] = []
      for (let i = 0; i < config.seedsPerMatchup; i++) {
        const seed = config.baseSeed + i
        const result = playGame({
          seed,
          strategy,
          enemyCompName: comp.name,
          initialStateOptions: {
            enemyTemplateIds: comp.enemyTemplateIds,
          },
          turnCap: config.turnCap,
        })
        const m = extractMetrics(result)
        games.push(m)
        perGame.push(m)
        perGameMeta.push({ strategy: strategy.name, enemyComp: comp.name, seed })
        done++
        if (onProgress && done % 50 === 0) onProgress(done, total)
      }
      matrix[strategy.name][comp.name] = aggregate(games)
    }
  }

  if (onProgress) onProgress(total, total)
  return {
    config,
    durationMs: Date.now() - start,
    totalGames: total,
    matrix,
    perGame,
    perGameMeta,
  }
}
