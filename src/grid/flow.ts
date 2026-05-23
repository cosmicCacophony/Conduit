import { GRID_HEIGHT, GRID_WIDTH, windToVector } from './constants'
import type { BattleState, GridCharacter, Position, Terrain, Tile, WindDirection } from './types'

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT
}

function cloneTerrain(terrain: Terrain | null): Terrain | null {
  return terrain ? { ...terrain } : null
}

export function cloneGrid(grid: Tile[][]): Tile[][] {
  return grid.map((row) =>
    row.map((tile) => ({
      x: tile.x,
      y: tile.y,
      terrain: cloneTerrain(tile.terrain),
      ghostTerrain: cloneTerrain(tile.ghostTerrain),
    })),
  )
}

function tileAt(grid: Tile[][], x: number, y: number): Tile | null {
  if (!inBounds(x, y)) return null
  return grid[y][x]
}

function nearestEdgeDirections(x: number, y: number): Array<{ dx: number; dy: number }> {
  const distances: Array<{ dx: number; dy: number; d: number }> = [
    { dx: 0, dy: -1, d: y },
    { dx: 0, dy: 1, d: GRID_HEIGHT - 1 - y },
    { dx: 1, dy: 0, d: GRID_WIDTH - 1 - x },
    { dx: -1, dy: 0, d: x },
  ]

  const minD = Math.min(...distances.map((d) => d.d))
  if (minD === 0) {
    return []
  }
  return distances.filter((d) => d.d === minD).map(({ dx, dy }) => ({ dx, dy }))
}

function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function nearestCharacter(from: Position, characters: GridCharacter[], maxRange: number): GridCharacter | null {
  let closest: GridCharacter | null = null
  let bestDist = Infinity
  for (const character of characters) {
    if (character.currentHp <= 0) continue
    const dist = chebyshev(from, character.position)
    if (dist <= maxRange && dist < bestDist) {
      bestDist = dist
      closest = character
    }
  }
  return closest
}

interface FlowResult {
  grid: Tile[][]
  events: string[]
}

/**
 * Apply one flow tick to the grid. Mutates the returned grid (cloned from input).
 * Order: earth (no-op, just blocks) -> water -> fire -> lightning.
 */
export function applyFlow(
  inputGrid: Tile[][],
  wind: WindDirection,
  allCharacters: GridCharacter[],
): FlowResult {
  const grid = cloneGrid(inputGrid)
  const events: string[] = []

  const sources: Array<{ x: number; y: number; terrain: Terrain }> = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const t = grid[y][x].terrain
      if (t) sources.push({ x, y, terrain: { ...t } })
    }
  }

  // Water: spread toward nearest edge(s)
  let waterSpread = 0
  for (const src of sources) {
    if (src.terrain.element !== 'water') continue
    const dirs = nearestEdgeDirections(src.x, src.y)
    for (const { dx, dy } of dirs) {
      const tx = src.x + dx
      const ty = src.y + dy
      const target = tileAt(grid, tx, ty)
      if (!target) continue
      if (target.terrain && target.terrain.element === 'earth') continue
      if (target.terrain && target.terrain.element !== 'water') continue
      const existingLife = target.terrain?.turnsRemaining ?? 0
      if (existingLife >= src.terrain.turnsRemaining) continue
      target.terrain = {
        element: 'water',
        turnsRemaining: src.terrain.turnsRemaining,
        placedBy: src.terrain.placedBy,
      }
      waterSpread++
    }
  }
  if (waterSpread > 0) events.push(`Water flowed across ${waterSpread} tiles.`)

  // Fire: spread in wind direction
  const wind_v = windToVector(wind)
  let fireSpread = 0
  for (const src of sources) {
    if (src.terrain.element !== 'fire') continue
    const tx = src.x + wind_v.dx
    const ty = src.y + wind_v.dy
    const target = tileAt(grid, tx, ty)
    if (!target) continue
    if (target.terrain && target.terrain.element === 'earth') continue
    if (target.terrain && target.terrain.element !== 'fire') continue
    const existingLife = target.terrain?.turnsRemaining ?? 0
    if (existingLife >= src.terrain.turnsRemaining) continue
    target.terrain = {
      element: 'fire',
      turnsRemaining: src.terrain.turnsRemaining,
      placedBy: src.terrain.placedBy,
    }
    fireSpread++
  }
  if (fireSpread > 0) events.push(`Fire spread on the ${wind} wind.`)

  // Lightning: jump to nearest character within 3
  let lightningJumps = 0
  for (const src of sources) {
    if (src.terrain.element !== 'lightning') continue
    const here = grid[src.y][src.x]
    if (!here.terrain || here.terrain.element !== 'lightning') continue
    const target = nearestCharacter({ x: src.x, y: src.y }, allCharacters, 3)
    if (!target) continue
    const targetTile = grid[target.position.y][target.position.x]
    if (targetTile.terrain && targetTile.terrain.element === 'earth') continue
    here.terrain = null
    targetTile.terrain = {
      element: 'lightning',
      turnsRemaining: src.terrain.turnsRemaining,
      placedBy: src.terrain.placedBy,
    }
    lightningJumps++
  }
  if (lightningJumps > 0) events.push(`Lightning leapt to ${lightningJumps} target${lightningJumps === 1 ? '' : 's'}.`)

  return { grid, events }
}

/**
 * Compute a one-step flow preview without modifying the live grid.
 * Returns a new grid where ghostTerrain is set on tiles that would change.
 */
export function computeGhostPreview(state: BattleState): Tile[][] {
  const characters = [...state.playerChars, ...state.enemyChars]
  const { grid: predicted } = applyFlow(state.grid, state.wind, characters)

  const result = cloneGrid(state.grid)
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cur = result[y][x].terrain
      const pred = predicted[y][x].terrain

      const same =
        (cur === null && pred === null) ||
        (cur !== null &&
          pred !== null &&
          cur.element === pred.element &&
          cur.turnsRemaining === pred.turnsRemaining)

      result[y][x].ghostTerrain = same ? null : pred ? { ...pred } : null
    }
  }
  return result
}

export function decrementTerrain(grid: Tile[][]): Tile[][] {
  return grid.map((row) =>
    row.map((tile) => {
      if (!tile.terrain) return { ...tile, ghostTerrain: null }
      const next = { ...tile.terrain, turnsRemaining: tile.terrain.turnsRemaining - 1 }
      return {
        ...tile,
        terrain: next.turnsRemaining <= 0 ? null : next,
        ghostTerrain: null,
      }
    }),
  )
}
