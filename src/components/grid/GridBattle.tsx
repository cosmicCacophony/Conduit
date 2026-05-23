import { useEffect, useMemo, useState } from 'react'

import './drift.css'
import {
  applyCascadePhase,
  applyCleanupPhase,
  applyFlowPhase,
  assignCard,
  canConfirmAssignments,
  clearSelectedAbility,
  confirmAssignments,
  createInitialState,
  endActorTurn,
  executeAbility,
  getAbilityTargets,
  getValidMoveTiles,
  moveCharacter,
  runEnemyTurn,
  selectAbility,
  unassignCard,
} from '../../grid/engine'
import { computeGhostPreview } from '../../grid/flow'
import type { BattleState, GridCharacter, Position } from '../../grid/types'
import { AbilityPanel } from './AbilityPanel'
import { BattleGrid } from './BattleGrid'
import { CardHand } from './CardHand'
import { CharacterRoster } from './CharacterRoster'
import { TurnLog } from './TurnLog'
import { WindIndicator } from './WindIndicator'

type GridBattleProps = {
  onExit: () => void
}

type LocalUI = {
  selectedCardId: string | null
  isMovingMode: boolean
  flashTick: number
  flashPositions: Position[]
}

export function GridBattle({ onExit }: GridBattleProps) {
  const [state, setState] = useState<BattleState>(() => createInitialState())
  const [ui, setUI] = useState<LocalUI>({
    selectedCardId: null,
    isMovingMode: false,
    flashTick: 0,
    flashPositions: [],
  })

  const currentActor = useMemo<GridCharacter | null>(() => {
    if (!state.currentActorId) return null
    return state.playerChars.find((c) => c.id === state.currentActorId) ?? null
  }, [state])

  // Auto-advance non-interactive phases
  useEffect(() => {
    if (state.phase === 'enemy') {
      const timer = setTimeout(() => setState((s) => runEnemyTurn(s)), 600)
      return () => clearTimeout(timer)
    }
    if (state.phase === 'flow') {
      const timer = setTimeout(() => setState((s) => applyFlowPhase(s)), 500)
      return () => clearTimeout(timer)
    }
    if (state.phase === 'cascade') {
      const timer = setTimeout(() => {
        setState((s) => {
          const next = applyCascadePhase(s)
          if (next.pendingFlash) {
            setUI((u) => ({
              ...u,
              flashTick: next.pendingFlash!.tick,
              flashPositions: next.pendingFlash!.positions,
            }))
            setTimeout(() => {
              setUI((u) => ({ ...u, flashPositions: [] }))
            }, 800)
          }
          return next
        })
      }, 600)
      return () => clearTimeout(timer)
    }
    if (state.phase === 'cleanup') {
      const timer = setTimeout(() => setState((s) => applyCleanupPhase(s)), 700)
      return () => clearTimeout(timer)
    }
  }, [state.phase])

  // Auto-skip dead actor's turn
  useEffect(() => {
    if (state.phase !== 'action' || !currentActor) return
    if (currentActor.currentHp <= 0) {
      setState((s) => endActorTurn(s))
    }
  }, [state.phase, currentActor])

  // Auto-end actor turn when both moved and acted
  useEffect(() => {
    if (state.phase !== 'action' || !currentActor) return
    if (currentActor.hasMoved && currentActor.hasActed) {
      const timer = setTimeout(() => setState((s) => endActorTurn(s)), 400)
      return () => clearTimeout(timer)
    }
  }, [state.phase, currentActor])

  const renderState: BattleState = useMemo(() => {
    if (state.phase === 'assign' || state.phase === 'action') {
      return { ...state, grid: computeGhostPreview(state) }
    }
    return state
  }, [state])

  const moveTargets = useMemo<Position[]>(() => {
    if (state.phase !== 'action' || !currentActor || !ui.isMovingMode) return []
    return getValidMoveTiles(state, currentActor)
  }, [state, currentActor, ui.isMovingMode])

  const abilityTargets = useMemo<Position[]>(() => {
    if (state.phase !== 'action' || !currentActor || !state.selectedAction) return []
    const ability = currentActor.abilities.find((a) => a.id === state.selectedAction!.abilityId)
    if (!ability) return []
    return getAbilityTargets(state, currentActor, ability)
  }, [state, currentActor])

  function handleSelectCard(cardId: string) {
    if (state.phase !== 'assign') return
    setUI((u) => ({ ...u, selectedCardId: u.selectedCardId === cardId ? null : cardId }))
  }

  function handleClickCharacter(character: GridCharacter) {
    if (state.phase === 'assign') {
      if (ui.selectedCardId) {
        setState((s) => assignCard(s, character.id, ui.selectedCardId!))
        setUI((u) => ({ ...u, selectedCardId: null }))
      } else if (state.assignments[character.id]) {
        setState((s) => unassignCard(s, character.id))
      }
    }
  }

  function handleConfirmAssignments() {
    if (!canConfirmAssignments(state)) return
    setState((s) => confirmAssignments(s))
    setUI((u) => ({ ...u, selectedCardId: null }))
  }

  function handleTileClick(pos: Position) {
    if (state.phase !== 'action' || !currentActor) return

    if (ui.isMovingMode) {
      const valid = moveTargets.some((p) => p.x === pos.x && p.y === pos.y)
      if (valid) {
        setState((s) => moveCharacter(s, pos))
        setUI((u) => ({ ...u, isMovingMode: false }))
      }
      return
    }

    if (state.selectedAction) {
      const valid = abilityTargets.some((p) => p.x === pos.x && p.y === pos.y)
      if (valid) {
        setState((s) => executeAbility(s, pos))
      }
    }
  }

  function handleEnableMove() {
    if (!currentActor || currentActor.hasMoved) return
    setUI((u) => ({ ...u, isMovingMode: true }))
    setState((s) => clearSelectedAbility(s))
  }

  function handleCancelMove() {
    setUI((u) => ({ ...u, isMovingMode: false }))
  }

  function handleSelectAbility(abilityId: string) {
    setUI((u) => ({ ...u, isMovingMode: false }))
    setState((s) => selectAbility(s, abilityId))
  }

  function handleCancelAbility() {
    setState((s) => clearSelectedAbility(s))
  }

  function handleEndTurn() {
    setUI((u) => ({ ...u, isMovingMode: false }))
    setState((s) => endActorTurn(s))
  }

  const phaseLabel = (() => {
    switch (state.phase) {
      case 'assign':
        return 'Assign cards'
      case 'action':
        return `${currentActor?.name ?? 'Actor'} acting`
      case 'enemy':
        return 'Enemies acting...'
      case 'flow':
        return 'Elements flowing...'
      case 'cascade':
        return 'Cascade!'
      case 'cleanup':
        return 'End of turn'
      case 'victory':
        return 'Victory'
      case 'defeat':
        return 'Defeat'
    }
  })()

  if (state.phase === 'victory' || state.phase === 'defeat') {
    return (
      <section className="screen drift-screen drift-screen--end">
        <p className="eyebrow">Drift</p>
        <h1>{state.phase === 'victory' ? 'The Tide Turns.' : 'The Storm Wins.'}</h1>
        <p className="lede">
          {state.phase === 'victory'
            ? 'You bent the elements to your will.'
            : 'The flow consumed you. Try again — wind always shifts.'}
        </p>
        <div className="drift-end-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setState(createInitialState())
              setUI({
                selectedCardId: null,
                isMovingMode: false,
                flashTick: 0,
                flashPositions: [],
              })
            }}
          >
            Restart
          </button>
          <button className="secondary-button" type="button" onClick={onExit}>
            Back to Title
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="screen drift-screen">
      <header className="drift-header">
        <div className="drift-header__title">
          <p className="eyebrow">Drift — Turn {state.turnNumber}</p>
          <h2>{phaseLabel}</h2>
        </div>
        <WindIndicator current={state.wind} upcoming={state.windQueue} />
        <button className="secondary-button" type="button" onClick={onExit}>
          Quit
        </button>
      </header>

      <div className="drift-body">
        <div className="drift-main">
          <BattleGrid
            state={renderState}
            moveTargets={moveTargets}
            abilityTargets={abilityTargets}
            flashTiles={ui.flashPositions}
            onTileClick={handleTileClick}
          />

          {state.phase === 'assign' ? (
            <div className="drift-assign-controls">
              <p className="muted">
                Click a card, then click a character. Card value = mana. Highest card acts first.
                Element match grants +1 mana.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={!canConfirmAssignments(state)}
                onClick={handleConfirmAssignments}
              >
                Confirm assignments
              </button>
            </div>
          ) : null}

          {state.phase === 'action' ? (
            <AbilityPanel
              actor={currentActor}
              selectedAction={state.selectedAction}
              canMove={!!currentActor && !currentActor.hasMoved}
              isMoving={ui.isMovingMode}
              onMove={handleEnableMove}
              onCancelMove={handleCancelMove}
              onSelectAbility={handleSelectAbility}
              onCancelAbility={handleCancelAbility}
              onEndTurn={handleEndTurn}
            />
          ) : null}
        </div>

        <aside className="drift-side">
          <CharacterRoster
            state={state}
            selectedCardId={ui.selectedCardId}
            onClickCharacter={handleClickCharacter}
            selectedActorId={state.currentActorId}
          />
        </aside>
      </div>

      <footer className="drift-footer">
        {state.phase === 'assign' ? (
          <CardHand
            state={state}
            selectedCardId={ui.selectedCardId}
            onSelectCard={handleSelectCard}
          />
        ) : null}
        <TurnLog log={state.log} />
      </footer>
    </section>
  )
}
