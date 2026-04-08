import { useEffect, useRef } from 'react'

import './App.css'
import { playSoundCue } from './audio'
import { CombatScreen } from './components/CombatScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { TeamSelectScreen } from './components/TeamSelectScreen'
import { TitleScreen } from './components/TitleScreen'
import { useRunState } from './hooks/useRunState'

function App() {
  const { state, dispatch, availableCreatures } = useRunState()
  const playedEffectRef = useRef<number | null>(null)

  useEffect(() => {
    if (!state.lastEffect || playedEffectRef.current === state.lastEffect.tick) {
      return
    }
    playedEffectRef.current = state.lastEffect.tick
    playSoundCue(state.lastEffect.sound)
  }, [state.lastEffect])

  function renderScreen() {
    switch (state.phase) {
      case 'title':
        return (
          <TitleScreen
            onStart={() => dispatch({ type: 'START_RUN' })}
            summary={{ runs: 0, wins: 0, bestStreak: 0 }}
          />
        )

      case 'teamSelect':
        return (
          <TeamSelectScreen
            creatures={availableCreatures}
            team={state.team}
            onSelectTeam={(ids) => dispatch({ type: 'SELECT_TEAM', creatureIds: ids })}
            onSelectRelic={(relicId) => dispatch({ type: 'SELECT_RELIC', relicId })}
          />
        )

      case 'combat':
        return (
          <CombatScreen
            state={state}
            onToggleCard={(index) => dispatch({ type: 'TOGGLE_CARD', index })}
            onPlayCards={() => dispatch({ type: 'PLAY_CARDS' })}
            onEndTurn={() => dispatch({ type: 'END_TURN' })}
          />
        )

      case 'victory':
      case 'defeat':
        return (
          <GameOverScreen
            result={state.phase}
            team={state.team}
            stats={state.stats}
            encounterIndex={state.encounterIndex}
            totalEncounters={state.encounters.length}
            onRestart={() => dispatch({ type: 'START_RUN' })}
          />
        )

      default:
        return null
    }
  }

  return (
    <main className="app-shell">
      <div className="app-frame">{renderScreen()}</div>
    </main>
  )
}

export default App
