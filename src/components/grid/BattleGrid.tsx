import { GRID_HEIGHT, GRID_WIDTH } from '../../grid/constants'
import type { BattleState, BonusKind, LogDetail, Position } from '../../grid/types'
import { GridTile, type ReplayHighlight } from './GridTile'

type BattleGridProps = {
  state: BattleState
  moveTargets: Position[]
  abilityTargets: Position[]
  flashTiles: Position[]
  replayDetail: LogDetail | null
  onTileClick: (pos: Position) => void
}

function buildReplaySets(state: BattleState, detail: LogDetail | null) {
  if (!detail) {
    return {
      active: false,
      primary: new Set<string>(),
      secondary: new Set<string>(),
      splash: new Set<string>(),
      damaged: new Set<string>(),
    }
  }
  const primary = new Set<string>()
  const secondary = new Set<string>()
  const splash = new Set<string>()
  const damaged = new Set<string>()

  if (detail.kind === 'cascade') {
    for (const p of detail.primaryTiles ?? []) primary.add(`${p.x},${p.y}`)
    for (const p of detail.secondaryTiles ?? []) secondary.add(`${p.x},${p.y}`)
    for (const p of detail.splashTiles ?? []) splash.add(`${p.x},${p.y}`)
  } else {
    for (const p of detail.tiles ?? []) primary.add(`${p.x},${p.y}`)
  }

  const allChars = [...state.playerChars, ...state.enemyChars]
  const damagedIds = new Set(detail.damagedCharIds)
  for (const c of allChars) {
    if (damagedIds.has(c.id)) damaged.add(`${c.position.x},${c.position.y}`)
  }

  return { active: true, primary, secondary, splash, damaged }
}

export function BattleGrid({
  state,
  moveTargets,
  abilityTargets,
  flashTiles,
  replayDetail,
  onTileClick,
}: BattleGridProps) {
  const moveSet = new Set(moveTargets.map((p) => `${p.x},${p.y}`))
  const targetSet = new Set(abilityTargets.map((p) => `${p.x},${p.y}`))
  const flashSet = new Set(flashTiles.map((p) => `${p.x},${p.y}`))
  const replay = buildReplaySets(state, replayDetail)

  const allChars = [...state.playerChars, ...state.enemyChars]
  const charByPos = new Map<string, (typeof allChars)[number]>()
  for (const c of allChars) {
    if (c.currentHp > 0) charByPos.set(`${c.position.x},${c.position.y}`, c)
  }

  const bonusByPos = new Map<string, BonusKind>()
  for (const b of state.bonusTiles ?? []) {
    bonusByPos.set(`${b.position.x},${b.position.y}`, b.kind)
  }

  const rows: React.ReactElement[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const cells: React.ReactElement[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = state.grid[y][x]
      const key = `${x},${y}`
      const character = charByPos.get(key) ?? null
      const bonusKind = bonusByPos.get(key) ?? null

      let replayHighlight: ReplayHighlight | null = null
      if (replay.active) {
        if (replay.primary.has(key)) replayHighlight = 'primary'
        else if (replay.secondary.has(key)) replayHighlight = 'secondary'
        else if (replay.splash.has(key)) replayHighlight = 'splash'
        else if (replay.damaged.has(key)) replayHighlight = 'damaged'
        else replayHighlight = 'dimmed'
      }

      cells.push(
        <GridTile
          key={key}
          tile={tile}
          character={character}
          isCurrentActor={character?.id === state.currentActorId}
          isMoveTarget={moveSet.has(key)}
          isAbilityTarget={targetSet.has(key)}
          isHighlighted={false}
          flashing={flashSet.has(key)}
          replayHighlight={replayHighlight}
          bonusKind={bonusKind}
          onClick={() => onTileClick({ x, y })}
        />,
      )
    }
    rows.push(
      <div key={y} className="grid-row">
        {cells}
      </div>,
    )
  }

  const replayClass = replay.active ? 'battle-grid battle-grid--replaying' : 'battle-grid'
  return <div className={replayClass}>{rows}</div>
}
