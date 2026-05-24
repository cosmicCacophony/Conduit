import {
  BONUS_TILES_PER_GAME,
  buildStarterDeck,
  ENEMY_TEMPLATES,
  GRID_HEIGHT,
  GRID_WIDTH,
  HAND_SIZE,
  instantiateCharacter,
  MEND_AMOUNT,
  nextWind,
  PLAYER_TEMPLATES,
  TERRAIN_LIFETIME,
  WIND_ROTATION,
} from './constants'
import { applyDamageEvents, resolveCascades } from './cascade'
import { applyFlow, cloneGrid, decrementTerrain } from './flow'
import { defaultRandom, type Random } from './random'
import type {
  Ability,
  AbilityShape,
  BattleState,
  BonusTile,
  Card,
  GridCharacter,
  LogDetail,
  LogEntry,
  Position,
  Terrain,
  Tile,
  WindDirection,
} from './types'

function makeLogEntry(turn: number, message: string, detail?: LogDetail): Omit<LogEntry, 'id'> {
  return detail ? { turn, message, detail } : { turn, message }
}

function appendLog(
  state: BattleState,
  entries: Array<Omit<LogEntry, 'id'>>,
): LogEntry[] {
  const result = [...state.log]
  for (const e of entries) {
    result.push({ ...e, id: `e${result.length}` })
  }
  return result
}

function emptyGrid(): Tile[][] {
  const grid: Tile[][] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row: Tile[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      row.push({ x, y, terrain: null, ghostTerrain: null })
    }
    grid.push(row)
  }
  return grid
}

function shuffle<T>(arr: T[], rng: Random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function spawnBonusTiles(
  rng: Random,
  count: number,
  excluded: Set<string>,
): BonusTile[] {
  // Middle 3x3 of the 5x5 grid: rows 1-3, cols 1-3.
  const candidates: Position[] = []
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 3; x++) {
      const key = `${x},${y}`
      if (excluded.has(key)) continue
      candidates.push({ x, y })
    }
  }
  const shuffled = shuffle(candidates, rng)
  return shuffled.slice(0, count).map((position) => ({
    kind: 'mend' as const,
    position,
  }))
}

function tryClaimBonus(state: BattleState, characterId: string): BattleState {
  if (state.bonusTiles.length === 0) return state
  const allChars = [...state.playerChars, ...state.enemyChars]
  const char = allChars.find((c) => c.id === characterId)
  if (!char || char.currentHp <= 0) return state
  const bonus = state.bonusTiles.find(
    (b) => b.position.x === char.position.x && b.position.y === char.position.y,
  )
  if (!bonus) return state

  if (bonus.kind === 'mend') {
    const headroom = char.maxHp - char.currentHp
    const healAmount = Math.min(MEND_AMOUNT, Math.max(0, headroom))
    const playerChars =
      healAmount > 0
        ? state.playerChars.map((c) =>
            c.id === characterId ? { ...c, currentHp: c.currentHp + healAmount } : c,
          )
        : state.playerChars
    const enemyChars =
      healAmount > 0
        ? state.enemyChars.map((c) =>
            c.id === characterId ? { ...c, currentHp: c.currentHp + healAmount } : c,
          )
        : state.enemyChars
    const bonusTiles = state.bonusTiles.filter(
      (b) => !(b.position.x === bonus.position.x && b.position.y === bonus.position.y),
    )
    const message =
      healAmount > 0
        ? `${char.name} mends (+${healAmount} HP).`
        : `${char.name} steps on a Mend tile (already at full HP).`
    return {
      ...state,
      playerChars,
      enemyChars,
      bonusTiles,
      log: appendLog(state, [makeLogEntry(state.turnNumber, message)]),
    }
  }

  return state
}

function drawCards(state: BattleState, count: number, rng: Random): BattleState {
  let deck = [...state.deck]
  let discard = [...state.discard]
  const hand: Card[] = []
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      deck = shuffle(discard, rng)
      discard = []
    }
    if (deck.length === 0) break
    const card = deck.pop()!
    hand.push(card)
  }
  return { ...state, deck, discard, hand }
}

export interface InitialStateOptions {
  rng?: Random
  playerTemplateIds?: string[]
  enemyTemplateIds?: string[]
}

export function createInitialState(options: InitialStateOptions = {}): BattleState {
  const rng = options.rng ?? defaultRandom

  const playerIds = options.playerTemplateIds ?? PLAYER_TEMPLATES.map((t) => t.id)
  const enemyIds = options.enemyTemplateIds ?? ENEMY_TEMPLATES.map((t) => t.id)

  const playerChars: GridCharacter[] = playerIds.map((id, idx) => {
    const template = PLAYER_TEMPLATES.find((t) => t.id === id) ?? PLAYER_TEMPLATES[idx % PLAYER_TEMPLATES.length]
    const char = instantiateCharacter(template, true, { x: idx, y: 4 })
    char.id = `${template.id}-p${idx}`
    return char
  })

  const enemyChars: GridCharacter[] = enemyIds.map((id, idx) => {
    const template = ENEMY_TEMPLATES.find((t) => t.id === id) ?? ENEMY_TEMPLATES[idx % ENEMY_TEMPLATES.length]
    const char = instantiateCharacter(template, false, { x: GRID_WIDTH - 1 - idx, y: 0 })
    char.id = `${template.id}-e${idx}`
    return char
  })

  const startingWind: WindDirection = WIND_ROTATION[Math.floor(rng.next() * WIND_ROTATION.length)]

  const occupied = new Set<string>()
  for (const c of [...playerChars, ...enemyChars]) {
    occupied.add(`${c.position.x},${c.position.y}`)
  }
  const bonusTiles = spawnBonusTiles(rng, BONUS_TILES_PER_GAME, occupied)

  const initial: BattleState = {
    grid: emptyGrid(),
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    playerChars,
    enemyChars,
    deck: shuffle(buildStarterDeck(), rng),
    discard: [],
    hand: [],
    assignments: {},
    wind: startingWind,
    windQueue: [nextWind(startingWind), nextWind(nextWind(startingWind))],
    turnNumber: 1,
    phase: 'assign',
    log: [{ id: 'e0', turn: 1, message: 'Battle begins. The wind picks up.' }],
    actionOrder: [],
    currentActorId: null,
    selectedAction: null,
    pendingFlash: null,
    bonusTiles,
  }

  return drawCards(initial, HAND_SIZE, rng)
}

export function assignCard(state: BattleState, characterId: string, cardId: string): BattleState {
  if (state.phase !== 'assign') return state
  const card = state.hand.find((c) => c.id === cardId)
  if (!card) return state

  const newAssignments = { ...state.assignments }
  for (const [cId, ccId] of Object.entries(newAssignments)) {
    if (ccId === cardId) delete newAssignments[cId]
  }
  newAssignments[characterId] = cardId

  return { ...state, assignments: newAssignments }
}

export function unassignCard(state: BattleState, characterId: string): BattleState {
  if (state.phase !== 'assign') return state
  const newAssignments = { ...state.assignments }
  delete newAssignments[characterId]
  return { ...state, assignments: newAssignments }
}

export function canConfirmAssignments(state: BattleState): boolean {
  const livingChars = state.playerChars.filter((c) => c.currentHp > 0)
  return livingChars.every((c) => state.assignments[c.id] !== undefined)
}

export function confirmAssignments(state: BattleState): BattleState {
  if (state.phase !== 'assign') return state
  if (!canConfirmAssignments(state)) return state

  const cardById = new Map(state.hand.map((c) => [c.id, c]))
  const livingChars = state.playerChars.filter((c) => c.currentHp > 0)

  const playerChars = state.playerChars.map((character) => {
    const cardId = state.assignments[character.id]
    if (!cardId) return character
    const card = cardById.get(cardId)
    if (!card) return character
    let mana = card.value
    if (card.element === character.element) mana += 2
    else mana = Math.max(1, mana - 1)
    return { ...character, mana, hasMoved: false, hasActed: false }
  })

  const order = livingChars
    .map((c) => ({
      id: c.id,
      value: cardById.get(state.assignments[c.id])!.value,
    }))
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.id)

  const usedCardIds = new Set(Object.values(state.assignments))
  const remainingHand = state.hand.filter((c) => !usedCardIds.has(c.id))
  const newDiscard = [...state.discard, ...state.hand.filter((c) => usedCardIds.has(c.id))]

  return {
    ...state,
    playerChars,
    actionOrder: order,
    currentActorId: order[0] ?? null,
    phase: 'action',
    hand: remainingHand,
    discard: newDiscard,
    assignments: {},
    log: appendLog(state, [makeLogEntry(state.turnNumber, `Turn ${state.turnNumber}: actions begin.`)]),
  }
}

function tileFreeForMovement(state: BattleState, x: number, y: number): boolean {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false
  const allChars = [...state.playerChars, ...state.enemyChars]
  if (allChars.some((c) => c.currentHp > 0 && c.position.x === x && c.position.y === y)) return false
  const tile = state.grid[y][x]
  if (tile.terrain && tile.terrain.element === 'earth') return false
  return true
}

export function getValidMoveTiles(state: BattleState, character: GridCharacter): Position[] {
  const result: Position[] = []
  const budget = character.movementBudget
  const seen = new Set<string>()
  const queue: Array<{ pos: Position; cost: number }> = [{ pos: character.position, cost: 0 }]
  seen.add(`${character.position.x},${character.position.y}`)
  while (queue.length) {
    const { pos, cost } = queue.shift()!
    if (cost > 0) result.push(pos)
    if (cost === budget) continue
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
    ]
    for (const { dx, dy } of dirs) {
      const nx = pos.x + dx
      const ny = pos.y + dy
      const key = `${nx},${ny}`
      if (seen.has(key)) continue
      if (!tileFreeForMovement(state, nx, ny)) continue
      seen.add(key)
      queue.push({ pos: { x: nx, y: ny }, cost: cost + 1 })
    }
  }
  return result
}

export function moveCharacter(state: BattleState, target: Position): BattleState {
  if (state.phase !== 'action') return state
  const actor = state.playerChars.find((c) => c.id === state.currentActorId)
  if (!actor) return state
  if (actor.hasMoved) return state
  const valid = getValidMoveTiles(state, actor)
  if (!valid.some((p) => p.x === target.x && p.y === target.y)) return state

  const playerChars = state.playerChars.map((c) =>
    c.id === actor.id ? { ...c, position: target, hasMoved: true } : c,
  )
  const moved: BattleState = {
    ...state,
    playerChars,
    log: appendLog(state, [
      makeLogEntry(state.turnNumber, `${actor.name} moves to (${target.x}, ${target.y}).`),
    ]),
  }
  return tryClaimBonus(moved, actor.id)
}

export function selectAbility(state: BattleState, abilityId: string): BattleState {
  if (state.phase !== 'action') return state
  const actor = state.playerChars.find((c) => c.id === state.currentActorId)
  if (!actor) return state
  if (actor.hasActed) return state
  const ability = actor.abilities.find((a) => a.id === abilityId)
  if (!ability) return state
  if (actor.mana < ability.manaCost) return state

  return {
    ...state,
    selectedAction: { characterId: actor.id, abilityId },
  }
}

export function clearSelectedAbility(state: BattleState): BattleState {
  return { ...state, selectedAction: null }
}

export function getAbilityTargets(
  _state: BattleState,
  character: GridCharacter,
  ability: Ability,
): Position[] {
  if (ability.selfTarget) {
    return [character.position]
  }
  const result: Position[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const dist = Math.abs(x - character.position.x) + Math.abs(y - character.position.y)
      if (dist <= ability.range) {
        result.push({ x, y })
      }
    }
  }
  return result
}

export function expandShape(
  origin: Position,
  shape: AbilityShape,
  fromPos: Position,
): Position[] {
  switch (shape) {
    case 'single':
      return [origin]
    case 'square2x2':
      return [
        { x: origin.x, y: origin.y },
        { x: origin.x + 1, y: origin.y },
        { x: origin.x, y: origin.y + 1 },
        { x: origin.x + 1, y: origin.y + 1 },
      ]
    case 'plus':
      return [
        { x: origin.x, y: origin.y },
        { x: origin.x + 1, y: origin.y },
        { x: origin.x - 1, y: origin.y },
        { x: origin.x, y: origin.y + 1 },
        { x: origin.x, y: origin.y - 1 },
      ]
    case 'line2':
    case 'line3': {
      const length = shape === 'line3' ? 3 : 2
      const dx = origin.x - fromPos.x
      const dy = origin.y - fromPos.y
      let stepX = 0
      let stepY = 0
      if (Math.abs(dx) >= Math.abs(dy)) {
        stepX = dx === 0 ? 1 : Math.sign(dx)
      } else {
        stepY = dy === 0 ? 1 : Math.sign(dy)
      }
      const tiles: Position[] = []
      for (let i = 0; i < length; i++) {
        tiles.push({ x: origin.x + stepX * i, y: origin.y + stepY * i })
      }
      return tiles
    }
  }
}

export function executeAbility(state: BattleState, target: Position): BattleState {
  if (state.phase !== 'action') return state
  if (!state.selectedAction) return state
  const actor = state.playerChars.find((c) => c.id === state.selectedAction!.characterId)
  if (!actor || actor.hasActed) return state
  const ability = actor.abilities.find((a) => a.id === state.selectedAction!.abilityId)
  if (!ability) return state
  if (actor.mana < ability.manaCost) return state

  const targets = getAbilityTargets(state, actor, ability)
  if (!targets.some((t) => t.x === target.x && t.y === target.y)) return state

  return resolveAbilityOnGrid(state, actor, ability, target, 'player')
}

function resolveAbilityOnGrid(
  state: BattleState,
  actor: GridCharacter,
  ability: Ability,
  target: Position,
  source: 'player' | 'enemy',
): BattleState {
  const tiles = expandShape(target, ability.shape, actor.position).filter(
    (t) => t.x >= 0 && t.x < GRID_WIDTH && t.y >= 0 && t.y < GRID_HEIGHT,
  )

  let grid = cloneGrid(state.grid)
  if (ability.placesTerrain) {
    for (const t of tiles) {
      const tile = grid[t.y][t.x]
      const lifetime = TERRAIN_LIFETIME[ability.element]
      if (tile.terrain?.element === 'earth' && ability.element !== 'earth') continue
      const newTerrain: Terrain = {
        element: ability.element,
        turnsRemaining: lifetime,
        placedBy: source,
      }
      tile.terrain = newTerrain
    }
  }

  const allChars = [...state.playerChars, ...state.enemyChars]
  const damaged = new Map<string, number>()
  if (ability.damage > 0) {
    for (const t of tiles) {
      for (const c of allChars) {
        if (c.currentHp <= 0) continue
        if (c.position.x === t.x && c.position.y === t.y) {
          if (source === 'player' && c.isPlayer) continue
          if (source === 'enemy' && !c.isPlayer) continue
          damaged.set(c.id, (damaged.get(c.id) ?? 0) + ability.damage)
        }
      }
    }
  }

  const playerChars = state.playerChars.map((c) => {
    const dmg = damaged.get(c.id) ?? 0
    let next = c
    if (dmg > 0) next = { ...next, currentHp: Math.max(0, next.currentHp - dmg) }
    if (c.id === actor.id && source === 'player') {
      next = { ...next, mana: next.mana - ability.manaCost, hasActed: true }
    }
    return next
  })

  const enemyChars = state.enemyChars.map((c) => {
    const dmg = damaged.get(c.id) ?? 0
    let next = c
    if (dmg > 0) next = { ...next, currentHp: Math.max(0, next.currentHp - dmg) }
    if (c.id === actor.id && source === 'enemy') {
      next = { ...next, mana: next.mana - ability.manaCost, hasActed: true }
    }
    return next
  })

  const detail: LogDetail = {
    kind: 'ability',
    actorId: actor.id,
    abilityId: ability.id,
    element: ability.element,
    tiles: tiles.map((t) => ({ x: t.x, y: t.y })),
    damagedCharIds: [...damaged.keys()],
  }

  return {
    ...state,
    grid,
    playerChars,
    enemyChars,
    selectedAction: null,
    log: appendLog(state, [
      makeLogEntry(state.turnNumber, `${actor.name} casts ${ability.name}.`, detail),
    ]),
  }
}

export function endActorTurn(state: BattleState): BattleState {
  if (state.phase !== 'action') return state
  const currentIdx = state.actionOrder.indexOf(state.currentActorId ?? '')
  const next = state.actionOrder
    .slice(currentIdx + 1)
    .find((id) => state.playerChars.find((c) => c.id === id && c.currentHp > 0))

  if (next) {
    return { ...state, currentActorId: next, selectedAction: null }
  }
  return { ...state, currentActorId: null, phase: 'enemy', selectedAction: null }
}

export function runEnemyTurn(state: BattleState): BattleState {
  if (state.phase !== 'enemy') return state
  let working: BattleState = { ...state }

  const livingEnemies = working.enemyChars.filter((e) => e.currentHp > 0)
  for (const enemy of livingEnemies) {
    working = simulateEnemyAction(working, enemy.id)
  }

  return { ...working, phase: 'flow' }
}

function simulateEnemyAction(state: BattleState, enemyId: string): BattleState {
  const enemyIdx = state.enemyChars.findIndex((e) => e.id === enemyId)
  if (enemyIdx < 0) return state
  const enemy = state.enemyChars[enemyIdx]
  if (enemy.currentHp <= 0) return state

  const livingPlayers = state.playerChars.filter((p) => p.currentHp > 0)
  if (livingPlayers.length === 0) return state

  let nearest = livingPlayers[0]
  let nearestDist = Infinity
  for (const p of livingPlayers) {
    const d = Math.abs(p.position.x - enemy.position.x) + Math.abs(p.position.y - enemy.position.y)
    if (d < nearestDist) {
      nearestDist = d
      nearest = p
    }
  }

  let working: BattleState = state
  const dxAxis = Math.sign(nearest.position.x - enemy.position.x)
  const dyAxis = Math.sign(nearest.position.y - enemy.position.y)
  const moveSteps = Math.min(enemy.movementBudget, Math.max(1, nearestDist - 2))
  for (let i = 0; i < moveSteps; i++) {
    const cur = working.enemyChars[enemyIdx]
    if (!cur || cur.currentHp <= 0) break
    const candidates = [
      { x: cur.position.x + dxAxis, y: cur.position.y },
      { x: cur.position.x, y: cur.position.y + dyAxis },
      { x: cur.position.x + dxAxis, y: cur.position.y + dyAxis },
    ].filter(
      (p) =>
        p.x >= 0 &&
        p.x < GRID_WIDTH &&
        p.y >= 0 &&
        p.y < GRID_HEIGHT &&
        ![...working.playerChars, ...working.enemyChars].some(
          (c) => c.currentHp > 0 && c.position.x === p.x && c.position.y === p.y,
        ) &&
        !(working.grid[p.y]?.[p.x]?.terrain?.element === 'earth'),
    )
    if (candidates.length === 0) break
    const chosen = candidates[0]
    working = {
      ...working,
      enemyChars: working.enemyChars.map((e) =>
        e.id === enemyId ? { ...e, position: chosen, hasMoved: true } : e,
      ),
      log: appendLog(working, [makeLogEntry(working.turnNumber, `${enemy.name} advances.`)]),
    }
    working = tryClaimBonus(working, enemyId)
  }

  const enemyNow = working.enemyChars[enemyIdx]
  if (!enemyNow || enemyNow.currentHp <= 0) return working

  const playerTarget = livingPlayers.reduce(
    (best, p) => {
      const d = Math.abs(p.position.x - enemyNow.position.x) + Math.abs(p.position.y - enemyNow.position.y)
      return d < best.dist ? { p, dist: d } : best
    },
    { p: livingPlayers[0], dist: Infinity },
  )

  const usableAbilities = enemyNow.abilities
    .filter((a) => a.manaCost <= 3)
    .sort((a, b) => b.damage - a.damage)

  for (const ability of usableAbilities) {
    if (ability.range >= playerTarget.dist) {
      const enemyAsActor = { ...enemyNow, mana: ability.manaCost }
      working = {
        ...working,
        enemyChars: working.enemyChars.map((e) =>
          e.id === enemyId ? enemyAsActor : e,
        ),
      }
      const targetPos = ability.selfTarget ? enemyNow.position : playerTarget.p.position
      working = resolveAbilityOnGrid(working, enemyAsActor, ability, targetPos, 'enemy')
      break
    }
  }

  return working
}

export function applyFlowPhase(state: BattleState): BattleState {
  if (state.phase !== 'flow') return state
  const allChars = [...state.playerChars, ...state.enemyChars]
  const { grid, events } = applyFlow(state.grid, state.wind, allChars)
  return {
    ...state,
    grid,
    log: events.length
      ? appendLog(state, events.map((msg) => makeLogEntry(state.turnNumber, msg)))
      : state.log,
    phase: 'cascade',
  }
}

export function applyCascadePhase(state: BattleState): BattleState {
  if (state.phase !== 'cascade') return state
  const allChars = [...state.playerChars, ...state.enemyChars]
  let { grid, damageEvents, events, reactions } = resolveCascades(state.grid, allChars)
  let newPlayerChars = applyDamageEvents(state.playerChars, damageEvents)
  let newEnemyChars = applyDamageEvents(state.enemyChars, damageEvents)

  // Chain cascades: keep resolving until no more reactions trigger
  let safety = 0
  while (true) {
    safety++
    if (safety > 5) break
    const {
      grid: g2,
      damageEvents: d2,
      events: e2,
      reactions: r2,
    } = resolveCascades(grid, [...newPlayerChars, ...newEnemyChars])
    if (r2.length === 0) break
    grid = g2
    newPlayerChars = applyDamageEvents(newPlayerChars, d2)
    newEnemyChars = applyDamageEvents(newEnemyChars, d2)
    events = [...events, ...e2]
    reactions = [...reactions, ...r2]
  }

  let nextPhase: BattleState['phase'] = 'cleanup'
  if (newPlayerChars.every((c) => c.currentHp <= 0)) nextPhase = 'defeat'
  else if (newEnemyChars.every((c) => c.currentHp <= 0)) nextPhase = 'victory'

  // Build LogEntries with cascade detail. events[i] corresponds 1:1 with reactions[i]
  // (cascade.ts pushes one event string per reaction in the same iteration order).
  const logEntries: Array<Omit<LogEntry, 'id'>> = []
  for (let i = 0; i < events.length; i++) {
    const message = events[i]
    const reaction = reactions[i]
    if (!reaction) {
      logEntries.push(makeLogEntry(state.turnNumber, message))
      continue
    }
    const damagedCharIds = damageEvents
      .filter((d) => d.reactionType === reaction.type)
      .map((d) => d.characterId)
    const detail: LogDetail = {
      kind: 'cascade',
      reactionType: reaction.type,
      primaryElement: reaction.primaryElement,
      secondaryElement: reaction.secondaryElement,
      primaryTiles: reaction.primaryTiles.map((p) => ({ x: p.x, y: p.y })),
      secondaryTiles: reaction.secondaryTiles.map((p) => ({ x: p.x, y: p.y })),
      splashTiles: reaction.splashTiles.map((p) => ({ x: p.x, y: p.y })),
      damagedCharIds: [...new Set(damagedCharIds)],
    }
    logEntries.push(makeLogEntry(state.turnNumber, message, detail))
  }

  return {
    ...state,
    grid,
    playerChars: newPlayerChars,
    enemyChars: newEnemyChars,
    log: logEntries.length ? appendLog(state, logEntries) : state.log,
    phase: nextPhase,
    pendingFlash: reactions.length
      ? {
          tick: Date.now(),
          kind: 'cascade',
          positions: reactions.flatMap((r) => [
            ...r.primaryTiles,
            ...r.secondaryTiles,
            ...r.splashTiles,
          ]),
        }
      : null,
  }
}

export function applyCleanupPhase(state: BattleState, rng: Random = defaultRandom): BattleState {
  if (state.phase !== 'cleanup') return state

  const grid = decrementTerrain(state.grid)
  const newWind = state.windQueue[0] ?? nextWind(state.wind)
  const upcomingWind = state.windQueue[1] ?? nextWind(newWind)
  const futureWind = nextWind(upcomingWind)

  let nextState: BattleState = {
    ...state,
    grid,
    wind: newWind,
    windQueue: [upcomingWind, futureWind],
    turnNumber: state.turnNumber + 1,
    phase: 'assign',
    log: appendLog(state, [makeLogEntry(state.turnNumber, `Wind shifts to the ${newWind}.`)]),
    actionOrder: [],
    currentActorId: null,
    pendingFlash: null,
  }

  nextState = drawCards(nextState, HAND_SIZE, rng)
  return nextState
}
