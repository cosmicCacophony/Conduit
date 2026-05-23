import { ELEMENT_ICONS } from '../../grid/constants'
import type { GridCharacter, Tile } from '../../grid/types'

type GridTileProps = {
  tile: Tile
  character: GridCharacter | null
  isCurrentActor: boolean
  isMoveTarget: boolean
  isAbilityTarget: boolean
  isHighlighted: boolean
  flashing: boolean
  onClick: () => void
}

export function GridTile({
  tile,
  character,
  isCurrentActor,
  isMoveTarget,
  isAbilityTarget,
  isHighlighted,
  flashing,
  onClick,
}: GridTileProps) {
  const classes = ['grid-tile']
  if (tile.terrain) classes.push(`grid-tile--${tile.terrain.element}`)
  if (tile.ghostTerrain && !tile.terrain) classes.push(`grid-tile--ghost-${tile.ghostTerrain.element}`)
  if (tile.ghostTerrain && tile.terrain && tile.ghostTerrain.element !== tile.terrain.element) {
    classes.push(`grid-tile--ghost-${tile.ghostTerrain.element}`)
  }
  if (isMoveTarget) classes.push('grid-tile--move')
  if (isAbilityTarget) classes.push('grid-tile--target')
  if (isHighlighted) classes.push('grid-tile--highlighted')
  if (flashing) classes.push('grid-tile--flash')

  return (
    <button type="button" className={classes.join(' ')} onClick={onClick}>
      {tile.terrain ? (
        <span className="grid-tile__terrain">
          <span className="grid-tile__terrain-glyph">{ELEMENT_ICONS[tile.terrain.element]}</span>
          <span className="grid-tile__terrain-life">{tile.terrain.turnsRemaining}</span>
        </span>
      ) : null}
      {tile.ghostTerrain && (!tile.terrain || tile.ghostTerrain.element !== tile.terrain.element) ? (
        <span className="grid-tile__ghost">{ELEMENT_ICONS[tile.ghostTerrain.element]}</span>
      ) : null}
      {character ? (
        <span
          className={[
            'grid-tile__character',
            character.isPlayer ? 'grid-tile__character--player' : 'grid-tile__character--enemy',
            isCurrentActor ? 'grid-tile__character--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="grid-tile__character-emoji">{character.emoji}</span>
          <span className="grid-tile__character-hp">
            {character.currentHp}/{character.maxHp}
          </span>
        </span>
      ) : null}
    </button>
  )
}
