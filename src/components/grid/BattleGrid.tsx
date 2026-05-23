import { GRID_HEIGHT, GRID_WIDTH } from '../../grid/constants'
import type { BattleState, Position } from '../../grid/types'
import { GridTile } from './GridTile'

type BattleGridProps = {
  state: BattleState
  moveTargets: Position[]
  abilityTargets: Position[]
  flashTiles: Position[]
  onTileClick: (pos: Position) => void
}

export function BattleGrid({
  state,
  moveTargets,
  abilityTargets,
  flashTiles,
  onTileClick,
}: BattleGridProps) {
  const moveSet = new Set(moveTargets.map((p) => `${p.x},${p.y}`))
  const targetSet = new Set(abilityTargets.map((p) => `${p.x},${p.y}`))
  const flashSet = new Set(flashTiles.map((p) => `${p.x},${p.y}`))

  const allChars = [...state.playerChars, ...state.enemyChars]
  const charByPos = new Map<string, (typeof allChars)[number]>()
  for (const c of allChars) {
    if (c.currentHp > 0) charByPos.set(`${c.position.x},${c.position.y}`, c)
  }

  const rows: React.ReactElement[] = []
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const cells: React.ReactElement[] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = state.grid[y][x]
      const key = `${x},${y}`
      const character = charByPos.get(key) ?? null
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

  return <div className="battle-grid">{rows}</div>
}
