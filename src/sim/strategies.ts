import { findReaction, GRID_HEIGHT, GRID_WIDTH, windToVector } from '../grid/constants'
import {
  expandShape,
  getAbilityTargets,
  getValidMoveTiles,
} from '../grid/engine'
import type {
  Ability,
  BattleState,
  Card,
  GridCharacter,
  Position,
} from '../grid/types'
import type { Random } from './random'

export interface AbilityChoice {
  abilityId: string
  target: Position
}

export interface Strategy {
  name: string
  /**
   * Marks a strategy as a control baseline that should be excluded from variance
   * verdict thresholds (dominant / weak / lopsided). It still appears in the
   * win-rate matrix; it just isn't expected to win.
   */
  isBaseline?: boolean
  assign(state: BattleState, rng: Random): Record<string, string>
  selectMove(state: BattleState, actor: GridCharacter, rng: Random): Position | null
  selectAction(state: BattleState, actor: GridCharacter, rng: Random): AbilityChoice | null
}

interface AssignContext {
  livingChars: GridCharacter[]
  hand: Card[]
}

function buildAssignContext(state: BattleState): AssignContext {
  return {
    livingChars: state.playerChars.filter((c) => c.currentHp > 0),
    hand: state.hand,
  }
}

function pickRandom<T>(arr: readonly T[], rng: Random): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(rng.next() * arr.length)]
}

function uniqueAssignment(
  characters: GridCharacter[],
  hand: Card[],
  scoreFn: (character: GridCharacter, card: Card) => number,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (characters.length === 0 || hand.length === 0) return result
  const usedCards = new Set<string>()
  const chars = [...characters]

  while (chars.length && usedCards.size < hand.length) {
    let bestChar: GridCharacter | null = null
    let bestCard: Card | null = null
    let bestScore = -Infinity
    for (const char of chars) {
      for (const card of hand) {
        if (usedCards.has(card.id)) continue
        const score = scoreFn(char, card)
        if (score > bestScore) {
          bestScore = score
          bestChar = char
          bestCard = card
        }
      }
    }
    if (!bestChar || !bestCard) break
    result[bestChar.id] = bestCard.id
    usedCards.add(bestCard.id)
    chars.splice(chars.indexOf(bestChar), 1)
  }
  return result
}

function manaIfAssigned(character: GridCharacter, card: Card): number {
  return card.value + (card.element === character.element ? 1 : 0)
}

function affordableAbilities(actor: GridCharacter): Ability[] {
  return actor.abilities.filter((a) => a.manaCost <= actor.mana)
}

function isInBounds(p: Position): boolean {
  return p.x >= 0 && p.x < GRID_WIDTH && p.y >= 0 && p.y < GRID_HEIGHT
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function buildTelegraphedTiles(state: BattleState): Set<string> {
  const set = new Set<string>()
  for (const intent of state.enemyIntents ?? []) {
    if (!intent.plannedAbility) continue
    const enemy = state.enemyChars.find((e) => e.id === intent.enemyId)
    if (!enemy || enemy.currentHp <= 0) continue
    const ability = enemy.abilities.find((a) => a.id === intent.plannedAbility!.abilityId)
    if (!ability || ability.damage <= 0) continue
    const fromPos = intent.plannedMove ?? enemy.position
    const tiles = expandShape(intent.plannedAbility.targetTile, ability.shape, fromPos).filter(
      isInBounds,
    )
    for (const t of tiles) set.add(`${t.x},${t.y}`)
  }
  return set
}

export function isTileTelegraphed(state: BattleState, p: Position): boolean {
  return buildTelegraphedTiles(state).has(`${p.x},${p.y}`)
}

function chooseMoveTowardSafe(
  state: BattleState,
  actor: GridCharacter,
  target: Position,
): Position | null {
  const tiles = getValidMoveTiles(state, actor)
  if (tiles.length === 0) return null
  const telegraphed = buildTelegraphedTiles(state)
  const here = `${actor.position.x},${actor.position.y}`
  const standingInDanger = telegraphed.has(here)

  let best: Position | null = null
  let bestScore = -Infinity
  for (const t of tiles) {
    const isDanger = telegraphed.has(`${t.x},${t.y}`)
    const dist = manhattan(t, target)
    let score = -dist
    if (isDanger) score -= 100
    if (!isDanger && standingInDanger) score += 50
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  if (!best) return null
  const sameOrFurther = manhattan(best, target) >= manhattan(actor.position, target)
  if (sameOrFurther && !standingInDanger) return null
  return best
}

function chooseMoveToward(state: BattleState, actor: GridCharacter, target: Position): Position | null {
  const tiles = getValidMoveTiles(state, actor)
  if (tiles.length === 0) return null
  let best = tiles[0]
  let bestDist = manhattan(best, target)
  for (const t of tiles) {
    const d = manhattan(t, target)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  if (bestDist >= manhattan(actor.position, target)) return null
  return best
}

function chooseMoveAway(state: BattleState, actor: GridCharacter, threats: Position[]): Position | null {
  const tiles = getValidMoveTiles(state, actor)
  if (tiles.length === 0 || threats.length === 0) return null
  const score = (p: Position) => threats.reduce((sum, t) => sum + manhattan(p, t), 0)
  let best = actor.position
  let bestScore = score(actor.position)
  for (const t of tiles) {
    const s = score(t)
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }
  if (best === actor.position) return null
  return best
}

function nearestEnemy(state: BattleState, actor: GridCharacter): GridCharacter | null {
  const enemies = state.enemyChars.filter((e) => e.currentHp > 0)
  if (enemies.length === 0) return null
  let best = enemies[0]
  let bestD = manhattan(actor.position, best.position)
  for (const e of enemies) {
    const d = manhattan(actor.position, e.position)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

function lowestHpEnemy(state: BattleState): GridCharacter | null {
  const alive = state.enemyChars.filter((e) => e.currentHp > 0)
  if (alive.length === 0) return null
  return alive.reduce((a, b) => (a.currentHp <= b.currentHp ? a : b))
}

function previewTiles(actor: GridCharacter, ability: Ability, target: Position): Position[] {
  return expandShape(target, ability.shape, actor.position).filter(isInBounds)
}

function enumerateActions(
  state: BattleState,
  actor: GridCharacter,
): Array<{ ability: Ability; target: Position; tiles: Position[] }> {
  const out: Array<{ ability: Ability; target: Position; tiles: Position[] }> = []
  for (const ability of affordableAbilities(actor)) {
    const targets = getAbilityTargets(state, actor, ability)
    for (const target of targets) {
      out.push({ ability, target, tiles: previewTiles(actor, ability, target) })
    }
  }
  return out
}

function damageDealtByAction(
  state: BattleState,
  ability: Ability,
  tiles: Position[],
  source: 'player',
): { totalDamage: number; lowestHpHit: number } {
  if (ability.damage <= 0) return { totalDamage: 0, lowestHpHit: Infinity }
  const targetSet = new Set(tiles.map((p) => `${p.x},${p.y}`))
  const targets = source === 'player' ? state.enemyChars : state.playerChars
  let total = 0
  let lowestHpHit = Infinity
  for (const c of targets) {
    if (c.currentHp <= 0) continue
    if (!targetSet.has(`${c.position.x},${c.position.y}`)) continue
    total += ability.damage
    if (c.currentHp < lowestHpHit) lowestHpHit = c.currentHp
  }
  return { totalDamage: total, lowestHpHit }
}

function placementWouldReact(
  state: BattleState,
  ability: Ability,
  tiles: Position[],
): { triggers: number; setsUp: number } {
  if (!ability.placesTerrain) return { triggers: 0, setsUp: 0 }
  let triggers = 0
  let setsUp = 0
  const placed = new Set(tiles.map((p) => `${p.x},${p.y}`))
  for (const tile of tiles) {
    const neighbors: Position[] = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ]
    for (const n of neighbors) {
      if (!isInBounds(n)) continue
      if (placed.has(`${n.x},${n.y}`)) continue
      const neighborTile = state.grid[n.y][n.x]
      const neighborTerrain = neighborTile.terrain
      if (!neighborTerrain) continue
      const reaction = findReaction(ability.element, neighborTerrain.element)
      if (reaction) {
        triggers++
      }
    }
  }
  setsUp = tiles.filter((t) => {
    const c = state.grid[t.y]?.[t.x]
    return c && !c.terrain
  }).length
  return { triggers, setsUp }
}

function distanceFromAnyEnemy(state: BattleState, p: Position): number {
  const enemies = state.enemyChars.filter((e) => e.currentHp > 0)
  if (enemies.length === 0) return 0
  return Math.min(...enemies.map((e) => manhattan(p, e.position)))
}

function tilesHitEnemy(state: BattleState, tiles: Position[]): number {
  const set = new Set(tiles.map((p) => `${p.x},${p.y}`))
  return state.enemyChars.filter(
    (e) => e.currentHp > 0 && set.has(`${e.position.x},${e.position.y}`),
  ).length
}

function characterRoleScore(character: GridCharacter, hint: 'damage' | 'cascade' | 'wall' | 'wind'): number {
  switch (hint) {
    case 'damage':
      return character.abilities.reduce((m, a) => Math.max(m, a.damage), 0)
    case 'cascade':
      // Prefer damage-dealers placed via lightning/water for big chains
      if (character.element === 'lightning' || character.element === 'water') return 2
      if (character.element === 'fire') return 1
      return 0
    case 'wall':
      return character.element === 'earth' ? 2 : 0
    case 'wind':
      return character.element === 'fire' ? 2 : character.element === 'lightning' ? 1 : 0
  }
}

// ----------------------------------------------------------------------------
// 1. Random
// ----------------------------------------------------------------------------
export const RandomStrategy: Strategy = {
  name: 'Random',
  isBaseline: true,
  assign(state, rng) {
    const { livingChars, hand } = buildAssignContext(state)
    const result: Record<string, string> = {}
    const cardIds = hand.map((c) => c.id)
    // shuffle cards
    for (let i = cardIds.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1))
      ;[cardIds[i], cardIds[j]] = [cardIds[j], cardIds[i]]
    }
    livingChars.forEach((c, idx) => {
      const cardId = cardIds[idx]
      if (cardId) result[c.id] = cardId
    })
    return result
  },
  selectMove(state, actor, rng) {
    const tiles = getValidMoveTiles(state, actor)
    if (tiles.length === 0 || rng.next() < 0.3) return null
    return pickRandom(tiles, rng)
  },
  selectAction(state, actor, rng) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    if (rng.next() < 0.1) return null
    const pick = pickRandom(actions, rng)
    if (!pick) return null
    return { abilityId: pick.ability.id, target: pick.target }
  },
}

// ----------------------------------------------------------------------------
// 2. GreedyDamage
// ----------------------------------------------------------------------------
export const GreedyDamageStrategy: Strategy = {
  name: 'GreedyDamage',
  assign(state) {
    const { livingChars, hand } = buildAssignContext(state)
    return uniqueAssignment(livingChars, hand, (character, card) => {
      const mana = manaIfAssigned(character, card)
      const role = characterRoleScore(character, 'damage')
      // Pour mana into damage characters
      return mana * (role + 1) * 10 + card.value
    })
  },
  selectMove(state, actor) {
    const lowest = lowestHpEnemy(state)
    if (!lowest) return null
    return chooseMoveTowardSafe(state, actor, lowest.position)
  },
  selectAction(state, actor) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    let best = actions[0]
    let bestScore = -Infinity
    for (const a of actions) {
      const dmg = damageDealtByAction(state, a.ability, a.tiles, 'player')
      let score = dmg.totalDamage * 10
      if (dmg.totalDamage > 0 && dmg.lowestHpHit !== Infinity) {
        // Bonus for finishing low-HP targets
        if (dmg.lowestHpHit <= a.ability.damage) score += 50
        score -= dmg.lowestHpHit
      }
      score -= a.ability.manaCost
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }
    if (bestScore <= 0) return null
    return { abilityId: best.ability.id, target: best.target }
  },
}

// ----------------------------------------------------------------------------
// 3. CascadeBuilder
// ----------------------------------------------------------------------------
export const CascadeBuilderStrategy: Strategy = {
  name: 'CascadeBuilder',
  assign(state) {
    const { livingChars, hand } = buildAssignContext(state)
    return uniqueAssignment(livingChars, hand, (character, card) => {
      const mana = manaIfAssigned(character, card)
      const role = characterRoleScore(character, 'cascade')
      return mana * (role + 1) * 10 + card.value
    })
  },
  selectMove(state, actor) {
    // Move toward existing terrain or nearest enemy
    let target: Position | null = null
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const t = state.grid[y][x].terrain
        if (!t) continue
        if (t.element === 'fire' || t.element === 'water' || t.element === 'lightning') {
          if (!target || manhattan(actor.position, { x, y }) < manhattan(actor.position, target)) {
            target = { x, y }
          }
        }
      }
    }
    if (!target) {
      const enemy = nearestEnemy(state, actor)
      if (enemy) target = enemy.position
    }
    if (!target) return null
    return chooseMoveTowardSafe(state, actor, target)
  },
  selectAction(state, actor) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    let best = actions[0]
    let bestScore = -Infinity
    for (const a of actions) {
      const dmg = damageDealtByAction(state, a.ability, a.tiles, 'player')
      const cascade = placementWouldReact(state, a.ability, a.tiles)
      let score = cascade.triggers * 30 + cascade.setsUp * 2 + dmg.totalDamage * 5
      // Bonus if placing element near enemy
      const enemy = lowestHpEnemy(state)
      if (enemy && a.ability.placesTerrain) {
        const minD = Math.min(
          ...a.tiles.map((t) => manhattan(t, enemy.position)),
        )
        score += Math.max(0, 5 - minD)
      }
      score -= a.ability.manaCost
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }
    if (bestScore < 0) return null
    return { abilityId: best.ability.id, target: best.target }
  },
}

// ----------------------------------------------------------------------------
// 4. WallSpammer
// ----------------------------------------------------------------------------
export const WallSpammerStrategy: Strategy = {
  name: 'WallSpammer',
  assign(state) {
    const { livingChars, hand } = buildAssignContext(state)
    return uniqueAssignment(livingChars, hand, (character, card) => {
      const mana = manaIfAssigned(character, card)
      const role = characterRoleScore(character, 'wall')
      return mana * (role + 1) * 10 + card.value
    })
  },
  selectMove(state, actor) {
    // Earth chars stay back; others move away from threats
    const enemyPositions = state.enemyChars.filter((e) => e.currentHp > 0).map((e) => e.position)
    if (actor.element === 'earth') {
      // Stay near players
      const allies = state.playerChars.filter((p) => p.currentHp > 0 && p.id !== actor.id)
      if (allies.length === 0) return null
      const center = {
        x: Math.round(allies.reduce((s, p) => s + p.position.x, 0) / allies.length),
        y: Math.round(allies.reduce((s, p) => s + p.position.y, 0) / allies.length),
      }
      return chooseMoveToward(state, actor, center)
    }
    return chooseMoveAway(state, actor, enemyPositions)
  },
  selectAction(state, actor) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    let best = actions[0]
    let bestScore = -Infinity
    for (const a of actions) {
      const dmg = damageDealtByAction(state, a.ability, a.tiles, 'player')
      let score = 0
      if (a.ability.element === 'earth') {
        // Score wall placement: tiles between actor and nearest enemy
        const enemy = nearestEnemy(state, actor)
        if (enemy) {
          const dActor = manhattan(actor.position, enemy.position)
          const placedBetween = a.tiles.filter((t) => {
            const dToEnemy = manhattan(t, enemy.position)
            return dToEnemy < dActor
          }).length
          score += placedBetween * 20 + a.tiles.length * 3
        } else {
          score += a.tiles.length * 2
        }
      } else {
        score += dmg.totalDamage * 8
      }
      score -= a.ability.manaCost
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }
    if (bestScore <= 0) return null
    return { abilityId: best.ability.id, target: best.target }
  },
}

// ----------------------------------------------------------------------------
// 5. WindRider
// ----------------------------------------------------------------------------
export const WindRiderStrategy: Strategy = {
  name: 'WindRider',
  assign(state) {
    const { livingChars, hand } = buildAssignContext(state)
    return uniqueAssignment(livingChars, hand, (character, card) => {
      const mana = manaIfAssigned(character, card)
      const role = characterRoleScore(character, 'wind')
      return mana * (role + 1) * 10 + card.value
    })
  },
  selectMove(state, actor) {
    const wind = windToVector(state.wind)
    const enemy = nearestEnemy(state, actor)
    if (!enemy) return null
    // For fire-starters: move so that wind direction from us points at enemy
    if (actor.element === 'fire') {
      // Want actor at position upwind from enemy: enemy - wind*k
      const ideal = { x: enemy.position.x - wind.dx * 2, y: enemy.position.y - wind.dy * 2 }
      return chooseMoveToward(state, actor, ideal)
    }
    return chooseMoveToward(state, actor, enemy.position)
  },
  selectAction(state, actor) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    const wind = windToVector(state.wind)
    const enemy = lowestHpEnemy(state) ?? nearestEnemy(state, actor)
    let best = actions[0]
    let bestScore = -Infinity
    for (const a of actions) {
      const dmg = damageDealtByAction(state, a.ability, a.tiles, 'player')
      let score = dmg.totalDamage * 6
      if (a.ability.element === 'fire' && enemy) {
        // Score by future spread alignment: how many tiles are upwind of enemy?
        for (const t of a.tiles) {
          const projected = { x: t.x + wind.dx, y: t.y + wind.dy }
          if (projected.x === enemy.position.x && projected.y === enemy.position.y) {
            score += 25
          }
          if (projected.x === enemy.position.x && Math.abs(projected.y - enemy.position.y) <= 1) {
            score += 5
          }
        }
        score += tilesHitEnemy(state, a.tiles) * 8
      } else if (a.ability.element === 'lightning') {
        // Lightning leaps to nearest character; place close to enemies
        if (enemy) score += Math.max(0, 6 - distanceFromAnyEnemy(state, a.target)) * 4
        score += dmg.totalDamage * 4
      } else if (a.ability.placesTerrain) {
        // Generic placement near enemies
        if (enemy) score += Math.max(0, 4 - distanceFromAnyEnemy(state, a.target)) * 2
      }
      score -= a.ability.manaCost
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }
    if (bestScore <= 0) return null
    return { abilityId: best.ability.id, target: best.target }
  },
}

// ----------------------------------------------------------------------------
// 6. Dodger
// ----------------------------------------------------------------------------
export const DodgerStrategy: Strategy = {
  name: 'Dodger',
  assign(state) {
    const { livingChars, hand } = buildAssignContext(state)
    return uniqueAssignment(livingChars, hand, (character, card) => {
      const mana = manaIfAssigned(character, card)
      const role = characterRoleScore(character, 'damage')
      return mana * (role + 1) * 8 + card.value
    })
  },
  selectMove(state, actor) {
    const tiles = getValidMoveTiles(state, actor)
    if (tiles.length === 0) return null
    const telegraphed = buildTelegraphedTiles(state)
    const standingInDanger = telegraphed.has(`${actor.position.x},${actor.position.y}`)

    const enemy = lowestHpEnemy(state) ?? nearestEnemy(state, actor)
    const targetPos = enemy?.position

    let best: Position = actor.position
    let bestScore = -Infinity
    const here = `${actor.position.x},${actor.position.y}`
    const considered: Position[] = standingInDanger ? tiles : [actor.position, ...tiles]
    for (const t of considered) {
      const key = `${t.x},${t.y}`
      const inDanger = telegraphed.has(key)
      let score = 0
      if (inDanger) score -= 200
      if (!inDanger && standingInDanger) score += 100
      if (targetPos) score -= manhattan(t, targetPos)
      if (key === here && !standingInDanger) score += 0.1
      if (score > bestScore) {
        bestScore = score
        best = t
      }
    }
    if (best.x === actor.position.x && best.y === actor.position.y) return null
    return best
  },
  selectAction(state, actor) {
    const actions = enumerateActions(state, actor)
    if (actions.length === 0) return null
    let best = actions[0]
    let bestScore = -Infinity
    for (const a of actions) {
      const dmg = damageDealtByAction(state, a.ability, a.tiles, 'player')
      let score = dmg.totalDamage * 8
      if (dmg.totalDamage > 0 && dmg.lowestHpHit !== Infinity) {
        if (dmg.lowestHpHit <= a.ability.damage) score += 40
      }
      score -= a.ability.manaCost
      if (score > bestScore) {
        bestScore = score
        best = a
      }
    }
    if (bestScore <= 0) return null
    return { abilityId: best.ability.id, target: best.target }
  },
}

export const ALL_STRATEGIES: Strategy[] = [
  RandomStrategy,
  GreedyDamageStrategy,
  CascadeBuilderStrategy,
  WallSpammerStrategy,
  WindRiderStrategy,
  DodgerStrategy,
]
