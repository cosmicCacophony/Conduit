import { findReaction, GRID_HEIGHT, GRID_WIDTH } from './constants'
import { cloneGrid } from './flow'
import type {
  Element,
  GridCharacter,
  Position,
  ReactionType,
  Tile,
} from './types'

interface CascadeReaction {
  type: ReactionType
  primaryElement: Element
  secondaryElement: Element
  primaryTiles: Position[]
  secondaryTiles: Position[]
  damage: number
}

interface CascadeResult {
  grid: Tile[][]
  reactions: CascadeReaction[]
  damageEvents: Array<{ characterId: string; amount: number; reactionType: ReactionType }>
  events: string[]
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

        reactions.push({
          type: reaction.type,
          primaryElement: primary,
          secondaryElement: secondary,
          primaryTiles,
          secondaryTiles,
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
  const damageEvents: Array<{ characterId: string; amount: number; reactionType: ReactionType }> = []
  const events: string[] = []

  if (reactions.length === 0) {
    return { grid, reactions, damageEvents, events }
  }

  for (const reaction of reactions) {
    if (reaction.type === 'electrified' || reaction.type === 'plasma') {
      const targetTiles = reaction.primaryTiles
      const targetSet = new Set(targetTiles.map((p) => `${p.x},${p.y}`))
      for (const character of characters) {
        if (character.currentHp <= 0) continue
        const key = `${character.position.x},${character.position.y}`
        if (targetSet.has(key)) {
          damageEvents.push({
            characterId: character.id,
            amount: reaction.damage,
            reactionType: reaction.type,
          })
        }
      }
      events.push(
        reaction.type === 'electrified'
          ? `Electrified! ${reaction.primaryTiles.length}-tile water chain shocks for ${reaction.damage}.`
          : `Plasma! ${reaction.primaryTiles.length}-tile fire chain ignites for ${reaction.damage}.`,
      )
    } else if (reaction.type === 'shatter') {
      const adjacencySet = new Set<string>()
      for (const tilePos of reaction.primaryTiles) {
        for (const { dx, dy } of NEIGHBORS) {
          adjacencySet.add(`${tilePos.x + dx},${tilePos.y + dy}`)
        }
      }
      for (const character of characters) {
        if (character.currentHp <= 0) continue
        const key = `${character.position.x},${character.position.y}`
        if (adjacencySet.has(key)) {
          damageEvents.push({
            characterId: character.id,
            amount: reaction.damage,
            reactionType: reaction.type,
          })
        }
      }
      events.push(`Shatter! Earth shears apart, dealing ${reaction.damage} to adjacent.`)
    } else if (reaction.type === 'steam') {
      events.push(`Steam! ${reaction.primaryTiles.length + reaction.secondaryTiles.length} tiles obscured.`)
    }
  }

  for (const key of involvedKeys) {
    const [xStr, yStr] = key.split(',')
    const x = Number(xStr)
    const y = Number(yStr)
    grid[y][x].terrain = null
  }

  return { grid, reactions, damageEvents, events }
}

export function applyDamageEvents(
  characters: GridCharacter[],
  events: Array<{ characterId: string; amount: number; reactionType: ReactionType }>,
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
