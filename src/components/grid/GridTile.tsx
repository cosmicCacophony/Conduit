import { ELEMENT_ICONS } from '../../grid/constants'
import type { BonusKind, GridCharacter, Tile } from '../../grid/types'

export type ReplayHighlight = 'primary' | 'secondary' | 'splash' | 'damaged' | 'dimmed'

const BONUS_GLYPH: Record<BonusKind, string> = {
  mend: '+',
}

const BONUS_LABEL: Record<BonusKind, string> = {
  mend: 'Mend +3 HP',
}

type GridTileProps = {
  tile: Tile
  character: GridCharacter | null
  isCurrentActor: boolean
  isMoveTarget: boolean
  isAbilityTarget: boolean
  isHighlighted: boolean
  flashing: boolean
  replayHighlight: ReplayHighlight | null
  bonusKind: BonusKind | null
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
  replayHighlight,
  bonusKind,
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
  if (replayHighlight) classes.push(`grid-tile--replay-${replayHighlight}`)
  if (bonusKind) classes.push(`grid-tile--bonus-${bonusKind}`)

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
      {bonusKind ? (
        <span
          className={`grid-tile__bonus grid-tile__bonus--${bonusKind}`}
          title={BONUS_LABEL[bonusKind]}
          aria-label={BONUS_LABEL[bonusKind]}
        >
          {BONUS_GLYPH[bonusKind]}
        </span>
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
