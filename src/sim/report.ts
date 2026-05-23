import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { aggregate, type AggStats, type GameMetrics } from './metrics'
import type { TournamentResult } from './tournament'
import type { VarianceReport } from './variance'

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width)
  return value + ' '.repeat(width - value.length)
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}

function fmtNum(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function formatWinRateTable(result: TournamentResult): string {
  const strategyNames = Object.keys(result.matrix)
  const compNames = result.config.enemyComps.map((c) => c.name)

  const colWidth = Math.max(12, ...compNames.map((c) => c.length + 2))
  const stratWidth = Math.max(16, ...strategyNames.map((s) => s.length + 2))

  const header =
    pad('Strategy', stratWidth) + compNames.map((c) => pad(c, colWidth)).join('') + pad('Avg', colWidth)
  const lines: string[] = [header, '-'.repeat(header.length)]
  for (const s of strategyNames) {
    const cells = compNames.map((c) => pad(fmtPct(result.matrix[s][c].winRate), colWidth))
    const avg =
      compNames.reduce((sum, c) => sum + result.matrix[s][c].winRate, 0) / compNames.length
    lines.push(pad(s, stratWidth) + cells.join('') + pad(fmtPct(avg), colWidth))
  }
  return lines.join('\n')
}

export function formatVarianceReport(variance: VarianceReport): string {
  const lines: string[] = []
  lines.push(`Verdict: ${variance.verdict.toUpperCase()}`)
  if (variance.dominantStrategy) lines.push(`  Dominant strategy: ${variance.dominantStrategy}`)
  else lines.push('  Dominant strategy: none')
  if (variance.weakStrategy) lines.push(`  Weak strategy: ${variance.weakStrategy}`)
  else lines.push('  Weak strategy: none')

  const coverageLine = Object.entries(variance.coverageScore)
    .map(([s, n]) => `${s}=${n}`)
    .join(', ')
  lines.push(`  Coverage scores: ${coverageLine}`)
  lines.push(`  Pairwise spread: ${fmtNum(variance.pairwiseSpread, 3)} (within-condition std dev)`)
  lines.push(`  Condition diversity: ${fmtNum(variance.conditionDiversity, 3)} (across-condition std dev)`)
  for (const note of variance.notes) lines.push(`  • ${note}`)
  return lines.join('\n')
}

export function summarizeOverall(result: TournamentResult): AggStats {
  return aggregate(result.perGame)
}

export function summarizePerStrategy(result: TournamentResult): Record<string, AggStats> {
  const byStrategy: Record<string, AggStats> = {}
  for (const strategy of result.config.strategies) {
    const games = result.perGame.filter(
      (_, i) => result.perGameMeta[i].strategy === strategy.name,
    )
    byStrategy[strategy.name] = aggregate(games)
  }
  return byStrategy
}

export function formatGlobalStats(result: TournamentResult): string {
  const all = summarizeOverall(result)
  const seconds = (result.durationMs / 1000).toFixed(1)
  return [
    `Games: ${result.totalGames}  |  Duration: ${seconds}s  |  Avg per game: ${(result.durationMs / result.totalGames).toFixed(1)}ms`,
    `Average game length: ${fmtNum(all.avgTurns)} turns`,
    `Average cascades/game: ${fmtNum(all.avgCascades)}  |  Avg cascade damage: ${fmtNum(all.avgCascadeDamage)}`,
    `Average decision branching factor: ${fmtNum(all.avgBranchingFactor, 1)}  |  Distinct strategic picks/turn: ${fmtNum(all.avgDistinctChoicesPerTurn, 2)}`,
    `Player-authored cascade %: ${fmtPct(all.avgPlayerAuthoredCascadePct)}  |  Cascade dmg %: ${fmtPct(all.avgCascadeDamagePct)}  |  Big spells/game: ${fmtNum(all.avgBigSpellCastsPerGame, 2)}`,
    `Cascade authorship totals: player=${all.cascadeAuthorshipTotals.player} enemy=${all.cascadeAuthorshipTotals.enemy} mixed=${all.cascadeAuthorshipTotals.mixed}`,
    `Cascade type mix: ${Object.entries(all.cascadeMix)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
    `Player terrain placement mix: ${Object.entries(all.terrainMix)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  ].join('\n')
}

export function formatFunSignalsByStrategy(result: TournamentResult): string {
  const byStrategy = summarizePerStrategy(result)
  const names = Object.keys(byStrategy)
  const stratWidth = Math.max(16, ...names.map((n) => n.length + 2))
  const lines: string[] = []
  lines.push(
    pad('Strategy', stratWidth) +
      pad('Author%', 10) +
      pad('BigSpells', 12) +
      pad('Variance', 10) +
      pad('CascadeDmg%', 14),
  )
  lines.push('-'.repeat(stratWidth + 10 + 12 + 10 + 14))
  for (const name of names) {
    const s = byStrategy[name]
    lines.push(
      pad(name, stratWidth) +
        pad(fmtPct(s.avgPlayerAuthoredCascadePct), 10) +
        pad(fmtNum(s.avgBigSpellCastsPerGame, 2), 12) +
        pad(fmtNum(s.avgDistinctChoicesPerTurn, 2), 10) +
        pad(fmtPct(s.avgCascadeDamagePct), 14),
    )
  }
  return lines.join('\n')
}

export function printConsoleReport(result: TournamentResult, variance: VarianceReport): void {
  console.log()
  console.log('=== Tournament Result ===')
  console.log(formatGlobalStats(result))
  console.log()
  console.log('=== Win Rate by (Strategy × Enemy Composition) ===')
  console.log(formatWinRateTable(result))
  console.log()
  console.log('=== Fun Signals by Strategy ===')
  console.log(formatFunSignalsByStrategy(result))
  console.log()
  console.log('=== Variance Analysis ===')
  console.log(formatVarianceReport(variance))
  console.log()
}

function buildMarkdownReport(result: TournamentResult, variance: VarianceReport): string {
  const strategyNames = Object.keys(result.matrix)
  const compNames = result.config.enemyComps.map((c) => c.name)
  const overall = summarizeOverall(result)
  const lines: string[] = []
  lines.push(`# Drift Sim — Variance Report`)
  lines.push('')
  lines.push(`**Generated:** ${new Date().toISOString()}`)
  lines.push(`**Total games:** ${result.totalGames}`)
  lines.push(`**Duration:** ${(result.durationMs / 1000).toFixed(1)}s`)
  lines.push(
    `**Config:** ${strategyNames.length} strategies × ${compNames.length} enemy comps × ${result.config.seedsPerMatchup} seeds`,
  )
  lines.push('')

  lines.push('## Verdict')
  lines.push('')
  lines.push(`**${variance.verdict.toUpperCase()}**`)
  lines.push('')
  for (const note of variance.notes) lines.push(`- ${note}`)
  lines.push('')
  lines.push(`- Dominant strategy: ${variance.dominantStrategy ?? 'none'}`)
  lines.push(`- Weak strategy: ${variance.weakStrategy ?? 'none'}`)
  lines.push(`- Pairwise spread (within condition): ${fmtNum(variance.pairwiseSpread, 3)}`)
  lines.push(`- Condition diversity (across conditions): ${fmtNum(variance.conditionDiversity, 3)}`)
  lines.push('')

  lines.push('## Win Rate Matrix')
  lines.push('')
  lines.push(`| Strategy | ${compNames.join(' | ')} | Avg |`)
  lines.push(`| --- | ${compNames.map(() => '---').join(' | ')} | --- |`)
  for (const s of strategyNames) {
    const cells = compNames.map((c) => fmtPct(result.matrix[s][c].winRate))
    const avg =
      compNames.reduce((sum, c) => sum + result.matrix[s][c].winRate, 0) / compNames.length
    lines.push(`| ${s} | ${cells.join(' | ')} | ${fmtPct(avg)} |`)
  }
  lines.push('')

  lines.push('## Coverage Score')
  lines.push('')
  lines.push('Number of conditions where strategy has ≥50% win rate.')
  lines.push('')
  lines.push('| Strategy | Coverage |')
  lines.push('| --- | --- |')
  for (const s of strategyNames) {
    lines.push(`| ${s} | ${variance.coverageScore[s]} / ${compNames.length} |`)
  }
  lines.push('')

  lines.push('## Detailed Stats per Matchup')
  lines.push('')
  lines.push(
    `| Strategy | Enemy Comp | Win Rate | Avg Turns | Avg Cascades | Author % | Big Spells/Game | Action Variance | Cascade Dmg % | Avg Player HP | Avg Enemy HP | Branching |`,
  )
  lines.push(
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
  )
  for (const s of strategyNames) {
    for (const c of compNames) {
      const stats = result.matrix[s][c]
      lines.push(
        `| ${s} | ${c} | ${fmtPct(stats.winRate)} | ${fmtNum(stats.avgTurns)} | ${fmtNum(stats.avgCascades)} | ${fmtPct(stats.avgPlayerAuthoredCascadePct)} | ${fmtNum(stats.avgBigSpellCastsPerGame, 2)} | ${fmtNum(stats.avgDistinctChoicesPerTurn, 2)} | ${fmtPct(stats.avgCascadeDamagePct)} | ${fmtNum(stats.avgPlayerHpRemaining)} | ${fmtNum(stats.avgEnemyHpRemaining)} | ${fmtNum(stats.avgBranchingFactor, 1)} |`,
      )
    }
  }
  lines.push('')

  // Fun-signal targets summary
  const overallStats = overall
  lines.push('## Fun-Signal Targets')
  lines.push('')
  lines.push('| Target | Threshold | Actual (avg) | Hit? |')
  lines.push('| --- | --- | --- | --- |')
  const targets: Array<{ label: string; threshold: string; actual: string; hit: boolean }> = [
    {
      label: 'Player-authored cascade %',
      threshold: '≥ 40%',
      actual: fmtPct(overallStats.avgPlayerAuthoredCascadePct),
      hit: overallStats.avgPlayerAuthoredCascadePct >= 0.4,
    },
    {
      label: 'Big-spell casts / game',
      threshold: '≥ 0.5',
      actual: fmtNum(overallStats.avgBigSpellCastsPerGame, 2),
      hit: overallStats.avgBigSpellCastsPerGame >= 0.5,
    },
    {
      label: 'Distinct strategic picks / turn',
      threshold: '≥ 2.0',
      actual: fmtNum(overallStats.avgDistinctChoicesPerTurn, 2),
      hit: overallStats.avgDistinctChoicesPerTurn >= 2.0,
    },
    {
      label: 'Cascade damage share',
      threshold: '20–55%',
      actual: fmtPct(overallStats.avgCascadeDamagePct),
      hit:
        overallStats.avgCascadeDamagePct >= 0.2 && overallStats.avgCascadeDamagePct <= 0.55,
    },
  ]
  for (const t of targets) {
    lines.push(`| ${t.label} | ${t.threshold} | ${t.actual} | ${t.hit ? 'YES' : 'NO'} |`)
  }
  lines.push('')

  // Ability-usage histogram per strategy
  lines.push('## Ability Usage by Strategy (casts per game)')
  lines.push('')
  const allAbilityIds = new Set<string>()
  const perStrategy = summarizePerStrategy(result)
  for (const stats of Object.values(perStrategy)) {
    for (const id of Object.keys(stats.abilityCastsByName)) allAbilityIds.add(id)
  }
  const abilityCols = [...allAbilityIds].sort()
  if (abilityCols.length === 0) {
    lines.push('_No player ability casts recorded._')
  } else {
    lines.push(`| Strategy | ${abilityCols.join(' | ')} | Total/Game |`)
    lines.push(`| --- | ${abilityCols.map(() => '---').join(' | ')} | --- |`)
    for (const s of strategyNames) {
      const stats = perStrategy[s]
      const games = Math.max(1, stats.games)
      const cells = abilityCols.map((id) =>
        fmtNum((stats.abilityCastsByName[id] ?? 0) / games, 2),
      )
      const total = abilityCols.reduce(
        (sum, id) => sum + (stats.abilityCastsByName[id] ?? 0),
        0,
      )
      lines.push(`| ${s} | ${cells.join(' | ')} | ${fmtNum(total / games, 2)} |`)
    }
  }
  lines.push('')

  // Cascade authorship
  lines.push('## Cascade Authorship')
  lines.push('')
  lines.push('Number of cascades grouped by who placed the reactive tiles.')
  lines.push('')
  lines.push(`- Player-authored: ${overallStats.cascadeAuthorshipTotals.player}`)
  lines.push(`- Enemy-authored: ${overallStats.cascadeAuthorshipTotals.enemy}`)
  lines.push(`- Mixed (both sides contributed, or terrain decayed): ${overallStats.cascadeAuthorshipTotals.mixed}`)
  lines.push('')

  lines.push('## Overall Stats')
  lines.push('')
  lines.push(`- Average game length: ${fmtNum(overall.avgTurns)} turns`)
  lines.push(`- Average cascades/game: ${fmtNum(overall.avgCascades)}`)
  lines.push(`- Average cascade damage: ${fmtNum(overall.avgCascadeDamage)}`)
  lines.push(`- Average decision branching factor: ${fmtNum(overall.avgBranchingFactor, 1)}`)
  lines.push('')
  lines.push('### Cascade Type Distribution')
  lines.push('')
  for (const [k, v] of Object.entries(overall.cascadeMix)) {
    lines.push(`- ${k}: ${v}`)
  }
  lines.push('')
  lines.push('### Player Terrain Placement Distribution')
  lines.push('')
  for (const [k, v] of Object.entries(overall.terrainMix)) {
    lines.push(`- ${k}: ${v}`)
  }
  lines.push('')

  lines.push('## Outcome Distribution')
  lines.push('')
  const reasons = countOutcomes(result.perGame)
  lines.push(`- Victory: ${reasons.victory}`)
  lines.push(`- Defeat: ${reasons.defeat}`)
  lines.push(`- Turn cap: ${reasons.turnCap}`)
  lines.push('')

  return lines.join('\n')
}

function countOutcomes(metrics: GameMetrics[]): { victory: number; defeat: number; turnCap: number } {
  const out = { victory: 0, defeat: 0, turnCap: 0 }
  for (const m of metrics) out[m.endReason]++
  return out
}

export interface WriteOptions {
  outDir?: string
  fileName?: string
}

export function writeMarkdownReport(
  result: TournamentResult,
  variance: VarianceReport,
  options: WriteOptions = {},
): string {
  const outDir = options.outDir ?? resolve(process.cwd(), 'sim-results')
  const ts = new Date()
  const stamp = ts.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const fileName = options.fileName ?? `${stamp}.md`
  const path = join(outDir, fileName)
  mkdirSync(dirname(path), { recursive: true })
  const md = buildMarkdownReport(result, variance)
  writeFileSync(path, md, 'utf-8')
  return path
}
