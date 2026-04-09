import { buildDeck } from '../engine/combat-engine'
import { ALL_CREATURES } from '../data/creatures'
import { ENEMY_TEMPLATES } from '../data/encounters'
import { simulateCombat, type SimResult } from './combat-sim'
import { ALL_STRATEGIES } from './strategies'
import type { CreatureTemplate } from '../types'

const RUNS_PER_STRATEGY = 1000

function creature(id: string): CreatureTemplate {
  return ALL_CREATURES.find((c) => c.id === id)!
}

const TEAMS: { name: string; members: CreatureTemplate[] }[] = [
  { name: 'Balanced (Ember+Moss+Drift)', members: [creature('ember'), creature('moss'), creature('drift')] },
  { name: 'Siphon (Shade+Moss+Ripple)', members: [creature('shade'), creature('moss'), creature('ripple')] },
  { name: 'Defensive (Ember+Thorn+Drift)', members: [creature('ember'), creature('thorn'), creature('drift')] },
  { name: 'Glass Cannon (Shade+Thorn+Ripple)', members: [creature('shade'), creature('thorn'), creature('ripple')] },
]

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function runBatch(enemyIndex: number, team: { name: string; members: CreatureTemplate[] }) {
  const enemy = ENEMY_TEMPLATES[enemyIndex]!
  const playerDeck = buildDeck(team.members)

  console.log(`\n  Team: ${team.name}`)
  console.log(`  Cards: ${team.members.map((c) => `${c.name}[${c.cardValues.join(',')}]`).join(' + ')}`)

  const header = [
    '  Strategy'.padEnd(14),
    'Win%'.padStart(6),
    'Turns'.padStart(6),
    'HP Lost'.padStart(8),
    'Passes'.padStart(7),
  ].join(' | ')
  console.log(header)
  console.log('  ' + '-'.repeat(header.length - 2))

  const stratResults: { name: string; avgHpLost: number; winPct: number }[] = []

  for (const { name, fn } of ALL_STRATEGIES) {
    const results: SimResult[] = []
    for (let i = 0; i < RUNS_PER_STRATEGY; i++) {
      results.push(simulateCombat(playerDeck, enemy, fn))
    }

    const wins = results.filter((r) => r.won).length
    const winPct = (wins / results.length) * 100
    const avgTurns = avg(results.map((r) => r.turns)).toFixed(1)
    const avgHpLost = avg(results.map((r) => r.hpLost))
    const avgPasses = avg(results.map((r) => r.passesUsed)).toFixed(1)

    stratResults.push({ name, avgHpLost, winPct })

    const row = [
      `  ${name}`.padEnd(14),
      `${winPct.toFixed(1)}%`.padStart(6),
      avgTurns.padStart(6),
      avgHpLost.toFixed(1).padStart(8),
      avgPasses.padStart(7),
    ].join(' | ')
    console.log(row)
  }

  const best = stratResults.reduce((a, b) => (a.avgHpLost < b.avgHpLost ? a : b))
  const worst = stratResults.reduce((a, b) => (a.avgHpLost > b.avgHpLost ? a : b))
  console.log(`  Best: ${best.name} (${best.avgHpLost.toFixed(1)} HP lost) | Worst: ${worst.name} (${worst.avgHpLost.toFixed(1)} HP lost)`)
}

console.log('CONDUIT - Combat Simulation Report (Multi-Team)')
console.log(`Date: ${new Date().toISOString().slice(0, 10)}`)
console.log(`${RUNS_PER_STRATEGY} simulations per strategy per team`)

for (let i = 0; i < ENEMY_TEMPLATES.length; i++) {
  const enemy = ENEMY_TEMPLATES[i]!
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${enemy.name} (${enemy.maxHp} HP, ${enemy.deck.length} cards)`)
  console.log(`  Deck: ${enemy.deck.map((c) => `${c.element[0]}${c.value}`).join(' ')}`)
  console.log(`${'='.repeat(70)}`)

  for (const team of TEAMS) {
    runBatch(i, team)
  }
}
