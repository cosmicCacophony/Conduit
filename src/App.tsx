import { useEffect } from 'react'

import './App.css'
import { CombatScreen } from './components/CombatScreen'
import { GameOverScreen } from './components/GameOverScreen'
import { RecruitScreen } from './components/RecruitScreen'
import { RewardScreen } from './components/RewardScreen'
import { TeamSelectScreen } from './components/TeamSelectScreen'
import { TitleScreen } from './components/TitleScreen'
import { useGameState } from './hooks/useGameState'
import type { RewardType } from './types'

function App() {
  const { state, dispatch, availableCreatures, selectedTeam } = useGameState()

  useEffect(() => {
    if (state.phase !== 'combat' || state.combatTurn !== 'enemy' || !state.enemy) {
      return
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ENEMY_TURN' })
    }, 650)

    return () => window.clearTimeout(timeout)
  }, [dispatch, state.combatTurn, state.enemy, state.phase])

  function handleReward(creatureId: string, reward: RewardType) {
    dispatch({ type: 'APPLY_REWARD', creatureId, reward })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function handleRecruit(creatureId: string) {
    dispatch({ type: 'RECRUIT', creatureId })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function handleSkipRecruit() {
    dispatch({ type: 'SKIP_RECRUIT' })
    dispatch({ type: 'NEXT_ENCOUNTER' })
  }

  function renderScreen() {
    switch (state.phase) {
      case 'title':
        return <TitleScreen onStart={() => dispatch({ type: 'START_RUN' })} />

      case 'teamSelect':
        return (
          <TeamSelectScreen
            creatures={availableCreatures}
            encounterIndex={state.encounterIndex}
            encounterText={state.encounterText}
            onConfirm={(ids) => dispatch({ type: 'SELECT_TEAM', ids })}
          />
        )

      case 'combat':
        if (!state.enemy) {
          return null
        }

        return (
          <CombatScreen
            team={selectedTeam}
            enemy={state.enemy}
            combatTurn={state.combatTurn}
            combatLog={state.combatLog}
            onAction={(creatureId, action, targetId) =>
              dispatch({ type: 'PLAYER_ACTION', creatureId, action, targetId })
            }
          />
        )

      case 'reward':
        return <RewardScreen creatures={selectedTeam} onApply={handleReward} />

      case 'recruit':
        return (
          <RecruitScreen
            encounterText={state.encounterText}
            creatures={state.recruitOffer}
            onRecruit={handleRecruit}
            onSkip={handleSkipRecruit}
          />
        )

      case 'victory':
        return (
          <GameOverScreen
            result="victory"
            roster={state.roster}
            stats={state.stats}
            onRestart={() => dispatch({ type: 'START_RUN' })}
          />
        )

      case 'defeat':
        return (
          <GameOverScreen
            result="defeat"
            roster={state.roster}
            stats={state.stats}
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
