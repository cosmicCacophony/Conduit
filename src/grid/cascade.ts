import { findReaction, GRID_HEIGHT, GRID_WIDTH } from './constants'
import { cloneGrid } from './flow'
import type {
  Element,
  GridCharacter,
  Position,
  ReactionType,
  Tile,
} from './types'

export interface CascadeReaction {
  type: ReactionType
  primaryElement: Element
  secondaryElement: Element
  primaryTiles: Position[]
  secondaryTiles: Position[]
  splashTiles: Position[]
  damage: number
}

export type CascadeDamageZone = 'primary' | 'splash'
export type CascadeDamageMultiplier = 'full' | 'half' | 'quarter'

export interface CascadeDamageEvent {
  characterId: string
  amount: number
  reaction: CascadeReaction
  zone: CascadeDamageZone
  multiplier: CascadeDamageMultiplier
}

function halve(n: number): number {
  return Math.max(1, Math.floor(n / 2))
}

interface CascadeResult {
  grid: Tile[][]
  reactions: CascadeReaction[]
  damageEvents: CascadeDamageEvent[]
}

const NEIGHBORS: Array<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
]

function tileAt(grid: Tile[][], x: number, y: number): Tile | null {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return null
  return grid[y][x]
}

function floodFill(
  grid: Tile[][],
  start: Position,
  element: Element,
  visited: Set<string>,
): Position[] {
  const result: Position[] = []
  const stack: Position[] = [start]
  while (stack.length) {
    const pos = stack.pop()!
    const key = `${pos.x},${pos.y}`
    if (visited.has(key)) continue
    const tile = tileAt(grid, pos.x, pos.y)
    if (!tile || !tile.terrain || tile.terrain.element !== element) continue
    visited.add(key)
    result.push(pos)
    for (const { dx, dy } of NEIGHBORS) {
      stack.push({ x: pos.x + dx, y: pos.y + dy })
    }
  }
  return result
}

export function detectCascades(grid: Tile[][]): {
  reactions: CascadeReaction[]
  involvedKeys: Set<string>
} {
  const reactions: CascadeReaction[] = []
  const visitedPrimary = new Set<string>()
  const visitedSecondary = new Set<string>()
  const involvedKeys = new Set<string>()

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = grid[y][x]
      if (!tile.terrain) continue
      const elementA = tile.terrain.element

      for (const { dx, dy } of NEIGHBORS) {
        const nx = x + dx
        const ny = y + dy
        const neighbor = tileAt(grid, nx, ny)
        if (!neighbor?.terrain) continue
        const elementB = neighbor.terrain.element
        if (elementA === elementB) continue

        const reaction = findReaction(elementA, elementB)
        if (!reaction) continue

        // Pick consistent primary by reaction order
        const [pairA, pairB] = reaction.pair
        const primary: Element = pairA
        const secondary: Element = pairB

        const primaryStart = elementA === primary ? { x, y } : { x: nx, y: ny }
        const secondaryStart = elementA === secondary ? { x, y } : { x: nx, y: ny }

        const primaryKey = `${primaryStart.x},${primaryStart.y}:${primary}`
        if (visitedPrimary.has(primaryKey)) continue

        const primaryTiles = floodFill(grid, primaryStart, primary, visitedPrimary)
        const secondaryTiles = floodFill(grid, secondaryStart, secondary, visitedSecondary)

        if (primaryTiles.length === 0 || secondaryTiles.length === 0) continue

        const chainSize = primaryTiles.length
        const damage = reaction.scalesWithChain
          ? reaction.damage * Math.max(1, Math.ceil(chainSize / 2))
          : reaction.damage

        const primaryKeySet = new Set(primaryTiles.map((p) => `${p.x},${p.y}`))
        const splashSet = new Set<string>()
        if (reaction.type === 'electrified' || reaction.type === 'plasma') {
          for (const tilePos of primaryTiles) {
            for (const { dx, dy } of NEIGHBORS) {
              const sx = tilePos.x + dx
              const sy = tilePos.y + dy
              if (sx < 0 || sx >= GRID_WIDTH || sy < 0 || sy >= GRID_HEIGHT) continue
              const sKey = `${sx},${sy}`
              if (primaryKeySet.has(sKey)) continue
              splashSet.add(sKey)
            }
          }
        } else if (reaction.type === 'shatter') {
          for (const tilePos of primaryTiles) {
            for (const { dx, dy } of NEIGHBORS) {
              const sx = tilePos.x + dx
              const sy = tilePos.y + dy
              if (sx < 0 || sx >= GRID_WIDTH || sy < 0 || sy >= GRID_HEIGHT) continue
              const sKey = `${sx},${sy}`
              if (primaryKeySet.has(sKey)) continue
              splashSet.add(sKey)
            }
          }
        }
        const splashTiles: Position[] = [...splashSet].map((k) => {
          const [xs, ys] = k.split(',')
          return { x: Number(xs), y: Number(ys) }
        })

        reactions.push({
          type: reaction.type,
          primaryElement: primary,
          secondaryElement: secondary,
          primaryTiles,
          secondaryTiles,
          splashTiles,
          damage,
        })

        for (const p of primaryTiles) involvedKeys.add(`${p.x},${p.y}`)
        for (const p of secondaryTiles) involvedKeys.add(`${p.x},${p.y}`)
      }
    }
  }

  return { reactions, involvedKeys }
}

export function resolveCascades(
  inputGrid: Tile[][],
  characters: GridCharacter[],
): CascadeResult {
  const grid = cloneGrid(inputGrid)
  const { reactions, involvedKeys } = detectCascades(grid)
  const damageEvents: CascadeDamageEvent[] = []

  if (reactions.length === 0) {
    return { grid, reactions, damageEvents }
  }

  for (const reaction of reactions) {
    if (reaction.type === 'electrified' || reaction.type === 'plasma') {
      const primarySet = new Set(reaction.primaryTiles.map((p) => `${p.x},${p.y}`))
      const splashSet = new Set(reaction.splashTiles.map((p) => `${p.x},${p.y}`))
      for (const character of characters) {
        if (character.currentHp <= 0) continue
        const key = `${character.position.x},${character.position.y}`
        if (primarySet.has(key)) {
          // Primary tile: enemies take full, players take half (friendly fire)
          const amount = character.isPlayer ? halve(reaction.damage) : reaction.damage
          damageEvents.push({
            characterId: character.id,
            amount,
            reaction,
            zone: 'primary',
            multiplier: character.isPlayer ? 'half' : 'full',
          })
        } else if (splashSet.has(key) && character.isPlayer) {
          // Splash radius: only damages allies (asymmetric) — quarter damage.
          damageEvents.push({
            characterId: character.id,
            amount: halve(halve(reaction.damage)),
            reaction,
            zone: 'splash',
            multiplier: 'quarter',
          })
        }
      }
    } else if (reaction.type === 'shatter') {
      const splashSet = new Set(reaction.splashTiles.map((p) => `${p.x},${p.y}`))
      for (const character of characters) {
        if (character.currentHp <= 0) continue
        const key = `${character.position.x},${character.position.y}`
        if (splashSet.has(key)) {
          damageEvents.push({
            characterId: character.id,
            amount: character.isPlayer ? halve(reaction.damage) : reaction.damage,
            reaction,
            zone: 'splash',
            multiplier: character.isPlayer ? 'half' : 'full',
          })
        }
      }
    }
    // steam: no damage events; engine emits no log entry for fizzle
  }

  for (const key of involvedKeys) {
    const [xStr, yStr] = key.split(',')
    const x = Number(xStr)
    const y = Number(yStr)
    grid[y][x].terrain = null
  }

  return { grid, reactions, damageEvents }
}

export function applyDamageEvents(
  characters: GridCharacter[],
  events: Array<{ characterId: string; amount: number }>,
): GridCharacter[] {
  const totals = new Map<string, number>()
  for (const event of events) {
    totals.set(event.characterId, (totals.get(event.characterId) ?? 0) + event.amount)
  }
  return characters.map((character) => {
    const dmg = totals.get(character.id) ?? 0
    if (dmg === 0) return character
    return { ...character, currentHp: Math.max(0, character.currentHp - dmg) }
  })
}
