import { extractMetrics } from './metrics'
import {
  formatGlobalStats,
  formatVarianceReport,
  formatWinRateTable,
  printConsoleReport,
  writeMarkdownReport,
} from './report'
import { playGame } from './runner'
import { ALL_STRATEGIES, type Strategy } from './strategies'
import {
  DEFAULT_TOURNAMENT_CONFIG,
  runTournament,
  type TournamentConfig,
} from './tournament'
import { analyzeVariance } from './variance'

interface ParsedArgs {
  command: string
  flags: Record<string, string | true>
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx >= 0) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
        flags[arg.slice(2)] = rest[i + 1]
        i++
      } else {
        flags[arg.slice(2)] = true
      }
    }
  }
  return { command, flags }
}

function strategyByName(name: string): Strategy {
  const found = ALL_STRATEGIES.find((s) => s.name.toLowerCase() === name.toLowerCase())
  if (!found) {
    console.error(`Unknown strategy: ${name}`)
    console.error(`Available: ${ALL_STRATEGIES.map((s) => s.name).join(', ')}`)
    process.exit(1)
  }
  return found
}

function flagNumber(flags: ParsedArgs['flags'], key: string, fallback: number): number {
  const v = flags[key]
  if (typeof v === 'string') {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function flagString(flags: ParsedArgs['flags'], key: string, fallback: string): string {
  const v = flags[key]
  if (typeof v === 'string') return v
  return fallback
}

function flagPresent(flags: ParsedArgs['flags'], key: string): boolean {
  return flags[key] !== undefined
}

function buildTournamentConfig(flags: ParsedArgs['flags']): TournamentConfig {
  const seedsPerMatchup = flagNumber(flags, 'seeds', DEFAULT_TOURNAMENT_CONFIG.seedsPerMatchup)
  const baseSeed = flagNumber(flags, 'base-seed', DEFAULT_TOURNAMENT_CONFIG.baseSeed)
  const turnCap = flagNumber(flags, 'turn-cap', DEFAULT_TOURNAMENT_CONFIG.turnCap ?? 30)
  return {
    ...DEFAULT_TOURNAMENT_CONFIG,
    seedsPerMatchup,
    baseSeed,
    turnCap,
  }
}

function logProgress(done: number, total: number): void {
  const pct = ((done / total) * 100).toFixed(0)
  process.stdout.write(`\r  ${done}/${total} (${pct}%)   `)
  if (done === total) process.stdout.write('\n')
}

function printHelp(): void {
  console.log(`Drift Sim Lab CLI

Usage:
  tsx src/sim/cli.ts <command> [options]

Commands:
  smoke        Run a small batch (default 10 games) with one strategy and print outcomes.
  tournament   Run the full strategy × enemy comp × seed matrix, print summary.
  variance     Run tournament + variance analysis, optionally write markdown report.
  help         Show this help.

Common options:
  --seeds=<n>          Seeds per matchup (default ${DEFAULT_TOURNAMENT_CONFIG.seedsPerMatchup}).
  --base-seed=<n>      Base seed (default ${DEFAULT_TOURNAMENT_CONFIG.baseSeed}).
  --turn-cap=<n>       Max turns per game (default 30).
  --strategy=<name>    For smoke: pick a strategy (default GreedyDamage).
  --report             For variance: also write markdown report to sim-results/.
  --out-dir=<path>     For variance: directory for markdown report (default sim-results/).
  --quiet              Suppress per-batch progress.

Strategies: ${ALL_STRATEGIES.map((s) => s.name).join(', ')}
`)
}

function runSmoke(flags: ParsedArgs['flags']): void {
  const strategyName = flagString(flags, 'strategy', 'GreedyDamage')
  const strategy = strategyByName(strategyName)
  const games = flagNumber(flags, 'games', 10)
  const baseSeed = flagNumber(flags, 'base-seed', 1)
  const turnCap = flagNumber(flags, 'turn-cap', 30)

  console.log(`Smoke test: ${strategy.name}, ${games} games, seeds ${baseSeed}..${baseSeed + games - 1}`)
  let wins = 0
  let defeats = 0
  let caps = 0
  for (let i = 0; i < games; i++) {
    const seed = baseSeed + i
    const result = playGame({ seed, strategy, turnCap })
    const m = extractMetrics(result)
    const tag = result.outcome === 'victory' ? '✔' : result.outcome === 'defeat' ? '✘' : '⏱'
    console.log(
      `  seed=${seed} ${tag} turns=${result.turns} cascades=${m.cascadesTriggered} dmgDealt=${m.totalDamageDealt} dmgTaken=${m.totalDamageTaken}`,
    )
    if (result.outcome === 'victory') wins++
    else if (result.outcome === 'defeat') defeats++
    else caps++
  }
  console.log(`\nSummary: ${wins}W / ${defeats}L / ${caps}T (turnCap)  win rate ${((wins / games) * 100).toFixed(0)}%`)
}

function runTournamentCmd(flags: ParsedArgs['flags']): void {
  const config = buildTournamentConfig(flags)
  console.log(
    `Tournament: ${config.strategies.length} strategies × ${config.enemyComps.length} enemy comps × ${config.seedsPerMatchup} seeds = ${
      config.strategies.length * config.enemyComps.length * config.seedsPerMatchup
    } games`,
  )
  const onProgress = flagPresent(flags, 'quiet') ? undefined : logProgress
  const result = runTournament(config, onProgress)
  console.log()
  console.log(formatGlobalStats(result))
  console.log()
  console.log(formatWinRateTable(result))
}

function runVarianceCmd(flags: ParsedArgs['flags']): void {
  const config = buildTournamentConfig(flags)
  console.log(
    `Variance run: ${config.strategies.length} × ${config.enemyComps.length} × ${config.seedsPerMatchup} = ${
      config.strategies.length * config.enemyComps.length * config.seedsPerMatchup
    } games`,
  )
  const onProgress = flagPresent(flags, 'quiet') ? undefined : logProgress
  const result = runTournament(config, onProgress)
  const variance = analyzeVariance(result)
  printConsoleReport(result, variance)
  if (flagPresent(flags, 'report')) {
    const outDir = flagString(flags, 'out-dir', 'sim-results')
    const path = writeMarkdownReport(result, variance, { outDir })
    console.log(`Wrote markdown report: ${path}`)
  } else {
    console.log('(use --report to write a markdown file to sim-results/)')
    console.log(formatVarianceReport(variance))
  }
}

function main(): void {
  const argv = process.argv.slice(2)
  const { command, flags } = parseArgs(argv)
  switch (command) {
    case 'smoke':
      runSmoke(flags)
      return
    case 'tournament':
      runTournamentCmd(flags)
      return
    case 'variance':
      runVarianceCmd(flags)
      return
    case 'help':
    default:
      printHelp()
  }
}

main()
